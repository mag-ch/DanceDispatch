import React from 'react';
import { Event, processUrl } from '@/lib/utils'
import { SaveEventButton } from './SaveEventButton';
import CustomLink from './CustomLink';
import styles from '@/app/styles/eventcard.module.css'; // changed from './eventcard.css'


interface EventCardProps {
    event: Event;
}

interface SearchResultProps {
    header: string;
    subheader: string;
    date?: string;
    price?: number;
    location?: string;
    img?: string;
    entityId?: string;
    entity?: string;
}

export const SearchResult: React.FC<SearchResultProps> = ({
    header,
    subheader,
    date,
    price,
    location,
    img,
    entityId,
    entity,
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

    return (
        <div className={styles.searchRow}>
            <CustomLink href={route || '#'} className={styles.searchLink}>
                <div className={styles.avatarWrap}>
                    <img
                        src={img || '/images/default_event.jpg'}
                        alt={header}
                        className={styles.avatarImg}
                    />
                </div>
                <div className={styles.searchText}>
                    <h4 className={styles.searchTitle}>{header}</h4>
                    <p className={styles.searchSub}>{subheader}</p>
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



export const RelatedEventCard: React.FC<EventCardProps> = ({ event }) => {
    const defaultThumbnail = event.imageurl == "" ? '/images/default_event.jpg' : event.imageurl;
    return (

        <CustomLink href={`/events/${event.id}`} className={styles.card}>
            <img src={defaultThumbnail} alt={event.title} className={styles.imageSm} />
            <div className={styles.content}>
                <h3 className={styles.titleMd}>{event.title}</h3>
                <p className={styles.description}>
                    {event.startdate ?? ""} @ {event.location ?? ""}
                </p>
            </div>
        </CustomLink>
    );
}

export const EventCard: React.FC<EventCardProps> = async ({ event }) => {
    const defaultThumbnail = event.imageurl == "" ? '/images/default_event.jpg' : event.imageurl;

    const formatDateAndTime = (date: string, time: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date([date, time].join(" ")));
    };

    const extLink = event.externallink ? await processUrl(event.externallink) : undefined;

    const truncateDescription = (text: string, maxLength: number = 100) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className={styles.card}>
            <CustomLink href={`/events/${event.id}`} className={styles.cardLink}>
                <img src={defaultThumbnail} alt={event.title} className={styles.imageLg} />
                <div className={styles.saveOverlay}>
                    <SaveEventButton entity='events' entityId={event.id} />
                </div>
                <div className={styles.content}>
                    <h3 className={styles.titleLg}>{event.title}</h3>
                    <p className={styles.description}>
                        {event.description ? truncateDescription(event.description) : ""}
                    </p>
                    <div className={styles.metaList}>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Start:</span>
                            {formatDateAndTime(event.startdate, event.starttime)}
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>End:</span>
                            {formatDateAndTime(event.enddate, event.endtime)}
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