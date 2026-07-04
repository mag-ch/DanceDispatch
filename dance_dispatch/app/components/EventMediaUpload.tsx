// First, update EventMediaUpload to support "inline" mode for the modal
// components/EventMediaUpload.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { Upload, X, ImageIcon, Film, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../providers/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { FileObject } from "@supabase/storage-js";


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
    hosts?: string [];
    mediaFiles?: MediaFile[];
}

export default function EventMediaUpload({ eventId, mode = 'standalone', onMediaChange, hosts, mediaFiles}: EventMediaUploadProps) {
    const supabase = createClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const { session, loading: authLoading } = useAuth();
    const userId = session?.user?.id ?? null;
    const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
    const [userMedia, setUserMedia] = useState<MediaFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [selectedHostTag, setSelectedHostTag] = useState<string>('');

    const [lightboxItem, setLightboxItem] = useState<MediaFile | null>(null);
const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    
    const folderPath = `events/${eventId}/${userId}`;

    const loadMedia = useCallback(async () => {
        const { data: folders } = await supabase.storage
            .from('event-media')
            .list(`events/${eventId}`, { limit: 200 });

        if (!folders) return;

        const allFiles: MediaFile[] = [];
        const myFiles: MediaFile[] = [];

        await Promise.all(
            folders.map(async (folder: FileObject) => {
                const { data: files } = await supabase.storage
                    .from('event-media')
                    .list(`events/${eventId}/${folder.name}`);

                if (!files) return;

                files.forEach((file: FileObject) => {
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

        if (hosts && hosts.length > 0) {
            setSelectedHostTag('');
            setPendingFile(file);
        } else {
            await uploadFile(file, '');
        }
    };

    const uploadFile = async (file: File, hostId: string) => {
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
            const suffix = hostId ? `_${hostId}` : '';
            const path = `${folderPath}/${Date.now()}${suffix}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('event-media').upload(path, fileToUpload);
            if (uploadError) throw uploadError;
            await loadMedia();
        } catch (err: any) {
            setError(err.message ?? 'Upload failed.');
        } finally {
            setUploading(false);
            setPendingFile(null);
            setSelectedHostTag('');
            if (inputRef.current) inputRef.current.value = '';
        }
    };
    const handleDelete = async (path: string) => {
        const { error } = await supabase.storage.from('event-media').remove([path]);
        if (!error) await loadMedia();
    };

    const slotsRemaining = MAX_FILES_PER_USER - userMedia.length;
    // In inline mode we only show the user's own files + upload button
    const displayMedia = mediaFiles
        ? mediaFiles
        : mode === 'inline' ? userMedia : allMedia;

    return (
        <div className='bg-surface rounded-lg p-3'>
            {mode === 'standalone' && (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-text">Community Media</h2>
                    <span className="text-xs text-muted">Your uploads: {userMedia.length}/{MAX_FILES_PER_USER}</span>
                </div>
            )}

            {/* Gallery */}
            {displayMedia.length > 0 && (
                <div className={`grid gap-2 ${mode === 'inline' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {displayMedia.map((item) => (
                        <div
                            key={item.path}
                            className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
                        >

                            {item.type === 'video' ? (
                                <div className="relative w-full h-full">
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                                    <div className="absolute inset-0" /> {/* blocks video click */}
                                </div>
                            ) : (
                                <img src={item.url} alt={item.name} className="w-full h-full object-cover " />
                            )}

                            <div className="absolute top-1.5 left-1.5 bg-black/50 rounded-full p-0.5 z-10 ">
                                {item.type === 'video'
                                    ? <Film size={10} className="text-white" />
                                    : <ImageIcon size={10} className="text-white" />
                                }
                            </div>

                                {/* Clickable overlay — sits behind everything else */}
                                <button
                                    type="button"
                                    onClick={() => setLightboxItem(item)}
                                    className="absolute inset-0 w-full h-full z-[1] cursor-pointer"
                                    aria-label="View media"
                                />
                           {item.path.includes(`/${userId}/`) && (
                            confirmingDelete === item.path ? (
                                <div
                                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="text-white text-xs font-semibold">Delete?</p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.path); setConfirmingDelete(null); }}
                                            className="px-2 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null); }}
                                            className="px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setConfirmingDelete(item.path); }}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                                    className="absolute top-1.5 right-1.5 z-10 hover:bg-red-600 rounded-full w-4 h-4 flex items-center justify-center transition-colors shadow-sm"
                                >
                                    <X size={10} className="text-white" />
                                </button>
                            )
                        )}
                        </div>
                    ))}
                </div>
            )}

            {!mediaFiles && mode === 'standalone' && allMedia.length === 0 && (
                <p className="text-sm text-muted mb-4">No media yet. Be the first to share!</p>
            )}

            {/* Upload button */}
            {!mediaFiles && pendingFile && hosts && hosts.length > 0 && (
                <div className="mb-3 rounded-lg border border-default bg-surface p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text">
                            Tag a host <span className="font-normal text-muted">(optional)</span>
                        </p>
                        <span className="text-xs text-muted truncate max-w-[140px]">{pendingFile.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedHostTag('')}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition
                                ${selectedHostTag === ''
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-default text-muted hover:border-blue-400'}`}
                        >
                            No tag
                        </button>
                        {hosts.map((host, id) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSelectedHostTag(host)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition
                                    ${selectedHostTag === host
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-default text-muted hover:border-blue-400'}`}
                            >
                                {host}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => uploadFile(pendingFile, selectedHostTag)}
                            disabled={uploading}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition disabled:opacity-50"
                        >
                            {uploading
                                ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                                : <><Upload size={14} /> Upload</>}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPendingFile(null);
                                setSelectedHostTag('');
                                if (inputRef.current) inputRef.current.value = '';
                            }}
                            disabled={uploading}
                            className="px-4 py-2 rounded-lg border border-default text-sm text-text hover:bg-accent transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {!mediaFiles && !(mode === 'standalone') && slotsRemaining > 0 && !pendingFile && (
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
                </div>
            )}

            {slotsRemaining === 0 && (
                <p className="text-xs text-muted text-center py-1">
                    {mode === 'inline' ? `Max ${MAX_FILES_PER_USER} files reached` : `You've used all ${MAX_FILES_PER_USER} upload slots for this event.`}
                </p>
            )}

            {!mediaFiles && error && <p className="mt-2 text-xs text-red-500 text-center">{error}</p>}

            {lightboxItem && (
                <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setLightboxItem(null)}
                >
                    <div
                        className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setLightboxItem(null)}
                            className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
                        >
                            <X size={18} /> Close
                        </button>

                        {/* Media */}
                        {lightboxItem.type === 'video' ? (
                            <video
                                src={lightboxItem.url}
                                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
                                controls
                                autoPlay
                                playsInline
                            />
                        ) : (
                            <img
                                src={lightboxItem.url}
                                alt={lightboxItem.name}
                                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                            />
                        )}

                        {/* Prev / Next navigation */}
                        {displayMedia.length > 1 && (() => {
                            const currentIndex = displayMedia.findIndex(m => m.path === lightboxItem.path);
                            const prev = displayMedia[currentIndex - 1];
                            const next = displayMedia[currentIndex + 1];
                            return (
                                <>
                                    {prev && (
                                        <button
                                            type="button"
                                            onClick={() => setLightboxItem(prev)}
                                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 text-white/70 hover:text-white transition-colors p-2"
                                            aria-label="Previous"
                                        >
                                            <ChevronLeft size={32} />
                                        </button>
                                    )}
                                    {next && (
                                        <button
                                            type="button"
                                            onClick={() => setLightboxItem(next)}
                                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 text-white/70 hover:text-white transition-colors p-2"
                                            aria-label="Next"
                                        >
                                            <ChevronRight size={32} />
                                        </button>
                                    )}
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-xs">
                                        {currentIndex + 1} / {displayMedia.length}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}