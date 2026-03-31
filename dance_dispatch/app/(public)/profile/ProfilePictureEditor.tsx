'use client';

import { ChangeEvent, startTransition, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DEFAULT_PROFILE_IMAGE = '/images/default_event.jpg';

type ProfilePictureEditorProps = {
  initialImageUrl?: string | null;
  displayName: string;
};

function revokeObjectUrl(url: string | null) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export default function ProfilePictureEditor({
  initialImageUrl,
  displayName,
}: ProfilePictureEditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialImageUrl || DEFAULT_PROFILE_IMAGE);
  const [serverImageUrl, setServerImageUrl] = useState(initialImageUrl || DEFAULT_PROFILE_IMAGE);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const nextUrl = initialImageUrl || DEFAULT_PROFILE_IMAGE;
    setServerImageUrl(nextUrl);
    setPreviewUrl((currentUrl) => (currentUrl.startsWith('blob:') ? currentUrl : nextUrl));
  }, [initialImageUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(previewUrl);
    };
  }, [previewUrl]);

  function handlePickImage() {
    inputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setError('Only JPEG, PNG, WEBP, and GIF images are supported.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    revokeObjectUrl(previewUrl);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
    setError(null);
  }

  function handleCancelSelection() {
    revokeObjectUrl(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(serverImageUrl);
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/profile-picture', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error || 'Failed to upload profile picture.');
        return;
      }

      const nextImageUrl = result?.profilePicture || DEFAULT_PROFILE_IMAGE;
      revokeObjectUrl(previewUrl);
      setServerImageUrl(nextImageUrl);
      setPreviewUrl(nextImageUrl);
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (uploadError) {
      console.error('Error uploading profile picture:', uploadError);
      setError('Failed to upload profile picture.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center h-full w-full">
      {/* Top 2/3 — image centered */}
      <div className="flex flex-[2] min-h-0 w-full items-end justify-center">
        <img
          src={previewUrl}
          alt={`${displayName} profile picture`}
          className="h-45 w-45 rounded-full border border-text/10 object-cover shadow-sm"
        />
      </div>

      {/* Bottom 1/3 — controls */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 w-full">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full rounded-full bg-text py-2 text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? 'Uploading...' : 'Save Photo'}
            </button>
            <button
              type="button"
              onClick={handleCancelSelection}
              disabled={isUploading}
              className="w-full rounded-full border border-text/20 py-2 text-sm font-semibold text-text transition hover:bg-text/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              type="button"
              onClick={handlePickImage}
              disabled={isUploading}
              className="w-full rounded-full bg-surface py-2 text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Edit Photo
            </button>
            <p className="text-center text-xs text-text/70 font-italic">
              JPG, PNG, WEBP, or GIF &middot; max 5 MB
            </p>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}