import React from 'react';
import { processUrl, resolveServerImageUrl } from '@/lib/utils'
import type { Event } from '@/lib/utils'
import { formatDateOnly } from '@/lib/date-utils';
import { SaveEventButton } from './SaveEventButton';
import CustomLink from './CustomLink';
import styles from '@/app/styles/eventcard.module.css'; // changed from './eventcard.css'
import UserBadgesInline, { BadgeChipsInline } from './UserBadgesInline';

interface EventCardProps {
    event: Event;
}

type CompactBadge = {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    sortOrder: number;
    unlockedAt: string;
};

interface SearchResultProps {
    header: string;
    subheader: string;
    date?: string;
    price?: number;
    location?: string;
    img?: string;
    entityId?: string;
    entity?: string;
    badgeUserId?: string;
    topBadges?: CompactBadge[];
}

const formatEventDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(date);
};

const formatEventTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
};


export const SearchResult: React.FC<SearchResultProps> = ({
    header,
    subheader,
    date,
    price,
    location,
    img,
    entityId,
    entity,
    badgeUserId,
    topBadges,
}) => {
    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(new Date(date));
    };
    const route = entity && entityId ? `/${entity}/${entityId}` : undefined;

    const hasPreloadedBadges = Array.isArray(topBadges) && topBadges.length > 0;

    const renderTopBadges = () => hasPreloadedBadges
        ? <BadgeChipsInline badges={topBadges} maxBadges={2} className="ml-1" showNames />
        : null;

    return (
        <div className={styles.searchRow}>
            <CustomLink href={route || '#'} className={styles.searchLink}>
                <div className={styles.avatarWrap}>
                    <img
                        src={img || `/images/default_${entity}.jpg`}
                        alt={header}
                        className={styles.avatarImg}
                    />
                </div>
                <div className={styles.searchText}>
                    <h4 className={styles.searchTitle}>
                        {header}
                        {entity === 'users' && (hasPreloadedBadges ? renderTopBadges() : <UserBadgesInline userId={badgeUserId ?? entityId} maxBadges={1} />)}
                    </h4>                    <p className={styles.searchSub}>
                        {subheader ? (subheader.length > 50 ? subheader.substring(0, 50) + '...' : subheader) : ''}
                    </p>
                    <div className={styles.searchMeta}>
                        {date && <span>{formatDate(date)}</span>}
                        {price && <span>${price}</span>}
                        {location && <span>{location}</span>}
                    </div>
                </div>
            </CustomLink>
        </div>
    );
};



export const RelatedEventCard: React.FC<EventCardProps> = async ({ event }) => {
    const defaultThumbnail = await resolveServerImageUrl(event.imageurl, `/images/default_events.jpg`);
    return (

        <CustomLink href={`/events/${event.id}`} className={styles.card}>
            <img src={defaultThumbnail} alt={event.title} className={styles.imageSm} />
            <div className={styles.content}>
                <h3 className={styles.titleMd}>{event.title}</h3>
                <p className={styles.description}>
                    {formatDateOnly(event.startdate, event.starttime)} @ {event.location ?? ""}
                </p>
            </div>
        </CustomLink>
    );
}

export const EventCard: React.FC<EventCardProps> = async ({ event }) => {
    const defaultThumbnail = await resolveServerImageUrl(event.imageurl, `/images/default_events.jpg`);
    const isPastEvent = new Date(`${event.enddate || event.startdate}T${event.endtime || event.starttime || '23:59:59'}`) < new Date();

    const extLink = event.externallink ?? undefined;
    const hostGenres = Array.from(new Set((event.hostGenres ?? []).map((genre) => String(genre).trim()).filter(Boolean)));

    const truncateDescription = (text: string, maxLength: number = 100) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className={styles.card}>
            <CustomLink href={`/events/${event.id}`} className={styles.cardLink}>
                <div className={styles.imageWrap}>
                    <img src={defaultThumbnail} alt={event.title} className={styles.imageLg} />
                    {hostGenres.length > 0 && (
                        <div className={styles.genreOverlay}>
                            <div className={styles.genreRow}>
                                {hostGenres.map((genre) => (
                                    <span key={genre} className={styles.genreChip}>{genre}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className={styles.saveOverlay}>
                        <SaveEventButton eventId={event.id} isDisabled={isPastEvent} />
                    </div>
                </div>
                <div className={styles.content}>
                    <h3 className={styles.titleLg}>{event.title}</h3>
                    <p className={styles.description}>
                        {event.description ? truncateDescription(event.description) : ""}
                    </p>
                    <div className={styles.metaList}>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Date:</span>
                            {formatEventDate(event.startdate)}
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Time:</span>
                            {formatEventTime(event.starttime)} - {formatEventTime(event.endtime)}
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Location:</span>
                            {event.location}
                        </div>
                        {event.price !== undefined && (
                            <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>Price:</span>${event.price}
                            </div>
                        )}
                    </div>
                </div>
            </CustomLink>

            {extLink && (
                <CustomLink
                    href={extLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ticketLink}
                >
                    <span className={styles.metaLabel}>Get Tickets →</span>
                </CustomLink>
            )}
        </div>
    );
};


// add venue info table and info display
// add host soundclod/spotify links
// fix review display format, make private comments visible only to followers
// user profile page