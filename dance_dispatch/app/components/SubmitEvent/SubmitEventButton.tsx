'use client';

import { useState } from 'react';
import type { ParsedEventData } from '@/app/api/parse-event/route';
import { ParseEventFromLink } from './ParseEventFromLink';
import { SubmitEventModal } from './SubmitEventModal';
import { X } from 'lucide-react';

type SubmitMode = 'choice' | 'link' | 'manual';

export function SubmitEventButton() {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<SubmitMode>('choice');
    const [parsedData, setParsedData] = useState<ParsedEventData | null>(null);

    const handleClose = () => {
        setOpen(false);
        setMode('choice');
        setParsedData(null);
    };

    const handleParsed = (data: ParsedEventData) => {
        setParsedData(data);
        setMode('manual');
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="btn-highlighted rounded-md px-5 py-2.5 text-sm font-semibold"
            >
                Submit an Event
            </button>

            {/* Choice Modal */}
            {open && mode === 'choice' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
                    <div className="relative w-full max-w-md rounded-xl bg-bg shadow-xl dark:bg-surface">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-text"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-6">
                            <h2 className="mb-6 text-center text-2xl font-bold text-text">
                                Submit an Event
                            </h2>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => setMode('link')}
                                    className="flex items-center gap-4 rounded-lg border-2 border-default p-4 transition-colors hover:border-blue-500 hover:bg-blue-500/5"
                                >
                                    <span className="text-3xl">🔗</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-text">Parse from Link</div>
                                        <div className="text-sm text-muted">
                                            Paste a URL and we'll auto-fill the details
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode('manual')}
                                    className="flex items-center gap-4 rounded-lg border-2 border-default p-4 transition-colors hover:border-blue-500 hover:bg-blue-500/5"
                                >
                                    <span className="text-3xl">✏️</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-text">Enter Manually</div>
                                        <div className="text-sm text-muted">
                                            Fill in all the event details yourself
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Parse Modal */}
            {open && mode === 'link' && (
                <ParseEventFromLink
                    onParsed={handleParsed}
                    onBack={() => setMode('choice')}
                    onClose={handleClose}
                />
            )}

            {/* Manual Entry Modal */}
            {open && mode === 'manual' && (
                <SubmitEventModal
                    isOpen={true}
                    onClose={handleClose}
                    onBack={parsedData ? () => setMode('link') : () => setMode('choice')}
                />
            )}
        </>
    );
}