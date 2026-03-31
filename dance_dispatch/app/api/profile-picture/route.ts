import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sanitizeFileName(fileName: string): string {
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const safeBaseName = baseName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${safeBaseName || 'profile-photo'}${extension}`;
}

function getStoragePathFromPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);

    if (url.origin !== projectUrl.origin) {
      return null;
    }

    const prefix = `/storage/v1/object/public/${PROFILE_PICTURE_BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file was provided' }, { status: 400 });
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WEBP, and GIF images are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('profiles')
      .select('profile_picture')
      .eq('id', user.id)
      .single();

    if (currentProfileError) {
      console.error('Error loading current profile picture:', currentProfileError);
      return NextResponse.json({ error: 'Failed to load current profile' }, { status: 500 });
    }

    const filePath = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { data: uploadedFile, error: uploadError } = await supabase.storage
      .from(PROFILE_PICTURE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading profile picture:', uploadError);

      const statusCode = String((uploadError as any)?.statusCode ?? (uploadError as any)?.status ?? '');
      const isRlsError =
        statusCode === '403' ||
        uploadError.message.toLowerCase().includes('row-level security policy');

      if (isRlsError) {
        return NextResponse.json(
          {
            error: `Upload blocked by Supabase Storage RLS for bucket "${PROFILE_PICTURE_BUCKET}". Add storage policies that allow authenticated users to insert/select/update/delete files in their own "${user.id}/" folder.`,
          },
          { status: 403 }
        );
      }

      return NextResponse.json({ error: 'Failed to upload profile picture' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PICTURE_BUCKET)
      .getPublicUrl(uploadedFile.path);

    const profilePicture = publicUrlData.publicUrl;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_picture: profilePicture })
      .eq('id', user.id);
    if (updateError) {
      await supabase.storage.from(PROFILE_PICTURE_BUCKET).remove([uploadedFile.path]);
      return NextResponse.json({ error: 'Failed to save profile picture' }, { status: 500 });
    }

    const previousStoragePath = getStoragePathFromPublicUrl(currentProfile?.profile_picture);
    if (previousStoragePath) {
      const { error: cleanupError } = await supabase.storage
        .from(PROFILE_PICTURE_BUCKET)
        .remove([previousStoragePath]);

      if (cleanupError) {
        console.warn('Error removing previous profile picture:', cleanupError);
      }
    }

    return NextResponse.json({ profilePicture });
  } catch (error) {
    console.error('Error in POST /api/profile-picture:', error);
    return NextResponse.json({ error: 'Failed to upload profile picture' }, { status: 500 });
  }
}