'use client';

import { useState } from 'react';
import { SubmitEventModal } from '@/app/components/SubmitEventModal';

export function SubmitEventButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="btn-highlighted rounded-md px-5 py-2.5 text-sm font-semibold"
            >
                Submit an Event
            </button>
            <SubmitEventModal isOpen={open} onClose={() => setOpen(false)} />
        </>
    );
}
