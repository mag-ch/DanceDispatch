// First, update EventMediaUpload to support "inline" mode for the modal
// components/EventMediaUpload.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { Upload, X, ImageIcon, Film, Loader2 } from 'lucide-react';
import { useAuth } from '../providers/AuthContext';
import { createClient } from '@/lib/supabase/client';

const MAX_FILES_PER_USER = 3;
const MAX_VIDEO_SECONDS = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];

export interface MediaFile {
    url: string;
    type: 'image' | 'video';
    name: string;
    path: string;
}

interface EventMediaUploadProps {
    eventId: string;
    // inline = compact mode inside modal; standalone = full gallery page section
    mode?: 'inline' | 'standalone';
    // in inline mode, notify parent of current files so they can be saved with the review
    onMediaChange?: (files: MediaFile[]) => void;
}

export default function EventMediaUpload({ eventId, mode = 'standalone', onMediaChange }: EventMediaUploadProps) {
    const supabase = createClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const { session, loading: authLoading } = useAuth();
    const userId = session?.user?.id ?? null;
    const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
    const [userMedia, setUserMedia] = useState<MediaFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const folderPath = `events/${eventId}/${userId}`;

    const loadMedia = useCallback(async () => {
        const { data: folders } = await supabase.storage
            .from('event-media')
            .list(`events/${eventId}`, { limit: 200 });

        if (!folders) return;

        const allFiles: MediaFile[] = [];
        const myFiles: MediaFile[] = [];

        await Promise.all(
            folders.map(async (folder) => {
                const { data: files } = await supabase.storage
                    .from('event-media')
                    .list(`events/${eventId}/${folder.name}`);

                if (!files) return;

                files.forEach((file) => {
                    const path = `events/${eventId}/${folder.name}/${file.name}`;
                    const { data: urlData } = supabase.storage
                        .from('event-media')
                        .getPublicUrl(path);

                    const isVideo = /\.(mp4|mov|webm)$/i.test(file.name);
                    const mediaFile: MediaFile = {
                        url: urlData.publicUrl,
                        type: isVideo ? 'video' : 'image',
                        name: file.name,
                        path,
                    };

                    allFiles.push(mediaFile);
                    if (folder.name === userId) myFiles.push(mediaFile);
                });
            })
        );

        setAllMedia(allFiles);
        setUserMedia(myFiles);
        onMediaChange?.(myFiles);
    }, [eventId, userId, supabase, onMediaChange]);

    useEffect(() => { loadMedia(); }, [loadMedia]);

    const getVideoDuration = (file: File): Promise<number> =>
        new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
            video.onerror = reject;
            video.src = URL.createObjectURL(file);
        });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);

        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Only JPEG, PNG, WebP images and MP4, MOV, WebM videos are allowed.');
            return;
        }
        if (userMedia.length >= MAX_FILES_PER_USER) {
            setError(`You've reached the limit of ${MAX_FILES_PER_USER} uploads per event.`);
            return;
        }
        if (file.type.startsWith('video/')) {
            try {
                const duration = await getVideoDuration(file);
                if (duration > MAX_VIDEO_SECONDS) {
                    setError(`Videos must be ${MAX_VIDEO_SECONDS}s or shorter (yours is ${Math.round(duration)}s).`);
                    return;
                }
            } catch {
                setError('Could not read video duration.');
                return;
            }
        }

        setUploading(true);
        try {
            let fileToUpload: File = file;
            if (file.type.startsWith('image/')) {
                fileToUpload = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                });
            }
            const ext = file.name.split('.').pop();
            const path = `${folderPath}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('event-media').upload(path, fileToUpload);
            if (uploadError) throw uploadError;
            await loadMedia();
        } catch (err: any) {
            setError(err.message ?? 'Upload failed.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleDelete = async (path: string) => {
        const { error } = await supabase.storage.from('event-media').remove([path]);
        if (!error) await loadMedia();
    };

    const slotsRemaining = MAX_FILES_PER_USER - userMedia.length;
    // In inline mode we only show the user's own files + upload button
    const displayMedia = mode === 'inline' ? userMedia : allMedia;

    return (
        <div className={mode === 'inline' ? '' : 'bg-surface rounded-lg p-6 mb-6'}>
            {mode === 'standalone' && (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-text">Community Media</h2>
                    <span className="text-xs text-muted">Your uploads: {userMedia.length}/{MAX_FILES_PER_USER}</span>
                </div>
            )}

            {/* Gallery */}
            {displayMedia.length > 0 && (
                <div className={`grid gap-2 mb-3 ${mode === 'inline' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {displayMedia.map((item) => (
                        <div key={item.path} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {item.type === 'video' ? (
                                <video src={item.url} className="w-full h-full object-cover" controls muted playsInline />
                            ) : (
                                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute top-1.5 left-1.5 bg-black/50 rounded-full p-0.5">
                                {item.type === 'video'
                                    ? <Film size={10} className="text-white" />
                                    : <ImageIcon size={10} className="text-white" />
                                }
                            </div>
                            {item.path.includes(`/${userId}/`) && (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(item.path)}
                                    className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={10} className="text-white" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {mode === 'standalone' && allMedia.length === 0 && (
                <p className="text-sm text-muted mb-4">No media yet. Be the first to share!</p>
            )}

            {/* Upload button */}
            {slotsRemaining > 0 && (
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(',')}
                        onChange={handleFileChange}
                        className="hidden"
                        id={`media-upload-${eventId}-${mode}`}
                    />
                    <label
                        htmlFor={`media-upload-${eventId}-${mode}`}
                        className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer transition-colors
                            ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400 hover:bg-blue-50/10'}`}
                    >
                        {uploading
                            ? <><Loader2 size={16} className="animate-spin text-blue-500" /><span className="text-sm text-text">Uploading...</span></>
                            : <><Upload size={16} className="text-blue-500" /><span className="text-sm text-text">
                                {mode === 'inline' ? 'Add photo or video' : 'Upload photo or video'}
                                <span className="text-muted ml-1">({slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} left)</span>
                              </span></>
                        }
                    </label>
                    {mode === 'standalone' && (
                        <p className="text-xs text-muted mt-1.5 text-center">
                            Images (JPEG, PNG, WebP) · Videos up to {MAX_VIDEO_SECONDS}s (MP4, MOV, WebM)
                        </p>
                    )}
                </div>
            )}

            {slotsRemaining === 0 && (
                <p className="text-xs text-muted text-center py-1">
                    {mode === 'inline' ? `Max ${MAX_FILES_PER_USER} files reached` : `You've used all ${MAX_FILES_PER_USER} upload slots for this event.`}
                </p>
            )}

            {error && <p className="mt-2 text-xs text-red-500 text-center">{error}</p>}
        </div>
    );
}