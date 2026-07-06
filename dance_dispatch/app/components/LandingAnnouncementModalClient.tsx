'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type LandingAnnouncementEvent = {
  id: string;
  title: string;
  subtitle: string;
  dayHeading: string;
  href: string;
};

type LandingAnnouncementModalClientProps = {
  announcementId: string;
  header: string;
  events: LandingAnnouncementEvent[];
};

export function LandingAnnouncementModalClient({
  announcementId,
  header,
  events,
}: LandingAnnouncementModalClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const shouldOpenFromQuery = useMemo(() => searchParams.get('announcement') === '1', [searchParams]);
  const viewedKey = useMemo(() => `dd-landing-announcement-viewed-${announcementId}`, [announcementId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (shouldOpenFromQuery) {
      setIsOpen(true);
      return;
    }

    const hasViewed = window.localStorage.getItem(viewedKey) === '1';
    if (!hasViewed) {
      setIsOpen(true);
      window.localStorage.setItem(viewedKey, '1');
    }
  }, [shouldOpenFromQuery, viewedKey]);

  const closeModal = () => {
    setIsOpen(false);

    if (!shouldOpenFromQuery) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('announcement');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
      <div className="w-full max-w-[75vw] max-h-[75vh] overflow-y-auto rounded-2xl border border-default bg-surface p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Announcement</p>
        <h2 id="announcement-modal-title" className="mt-2 text-2xl font-bold text-text">{header}</h2>

        {events.length > 0 ? (
          <div className="mt-4 space-y-4">
            {events.map((event, index) => {
              const isNewDay = index === 0 || events[index - 1]?.dayHeading !== event.dayHeading;

              return (
                <div key={event.id} className="space-y-2">
                  {isNewDay && (
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
                      {event.dayHeading}
                    </h3>
                  )}
                  <Link
                    href={event.href}
                    onClick={closeModal}
                    className="block rounded-lg border border-default bg-bg px-3 py-2 text-sm text-text transition hover-bg-accent-soft"
                  >
                    <span className="font-semibold">{event.title}</span>
                    <span className="mt-1 block text-xs text-muted">{event.subtitle}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No parties were found for this weekend.</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
