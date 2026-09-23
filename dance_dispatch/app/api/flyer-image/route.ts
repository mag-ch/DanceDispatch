import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

const FLYER_IMAGE_BUCKET = 'FLYER_IMAGE_BUCKET';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sanitizeFileName(fileName: string): string {
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const safeBaseName = baseName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${safeBaseName || 'flyer'}${extension}`;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No flyer image was provided' }, { status: 400 });
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WEBP, and GIF images are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Flyer image must be 5 MB or smaller' }, { status: 400 });
    }

    const filePath = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { data: uploadedFile, error: uploadError } = await supabase.storage
      .from(FLYER_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading flyer image:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload flyer image. Ensure the Supabase bucket "${FLYER_IMAGE_BUCKET}" exists and is configured for uploads.` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(FLYER_IMAGE_BUCKET)
      .getPublicUrl(uploadedFile.path);

    return NextResponse.json({ imageUrl: publicUrlData.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload flyer image';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
