import React from 'react';
import { Event, processUrl, checkEventSaved } from '../../lib/utils'
import { SaveEventButton } from './SaveEventButton';
import { getCurrentUserId } from '../../lib/auth-helpers';

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
        <div 
            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
            <div 
            onClick={() => route ? window.location.href = route : undefined}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <img
                src={img || '/images/default_event.jpg'}
                alt={header}
                className="w-10 h-10 object-cover rounded-full"
                />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">{header}</h4>
                <p className="text-sm text-gray-600">{subheader}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                {date && <span>{formatDate(date)}</span>}
                {price !== undefined && <span>${price}</span>}
                {location && <span>{location}</span>}
                </div>
            </div>
            </div>
            {entityId && entity && (
            <SaveEventButton entity={entity} entityId={entityId} />
            )}
        </div>
    );
};

export const EventCard: React.FC<EventCardProps> = async ({ event }) => {
    const defaultThumbnail = event.imageurl == "" ? '/images/default_event.jpg' : event.imageurl;
    
    const formatDateAndTime = (date: string, time:string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date([date, time].join(" ")));
    };

    const userId = await getCurrentUserId();
    const isSaved = await checkEventSaved(event, userId);
    

    const extLink = event.externallink ? await processUrl(event.externallink): undefined;

    const truncateDescription = (text: string, maxLength: number = 100) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className="w-full bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <a href={`/events/${event.id}`} className="relative">
                <img
                    src={defaultThumbnail}
                    alt={event.title}
                    className="w-full h-48 object-cover"
                />
                <div className='absolute top-4 left-4'>

                <SaveEventButton entity='events' entityId={event.id} initialSaved={isSaved} />
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold">{event.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">
                        {event.description ? truncateDescription(event.description):""}
                    </p>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-700">
                            <span className="font-semibold mr-2">Start:</span>
                            {formatDateAndTime(event.startdate, event.starttime)}
                        </div>
                        <div className="flex items-center text-gray-700">
                            <span className="font-semibold mr-2">End:</span>
                            {formatDateAndTime(event.enddate, event.endtime)}
                        </div>
                        <div className="flex items-center text-gray-700">
                            <span className="font-semibold mr-2">Location:</span>
                            {event.location}
                        </div>
                        {!isNaN(event.price) && (
                            <div className="flex items-center text-gray-900">
                                <span className="font-semibold mr-2">Price:</span>
                                ${event.price ?? "?"}
                            </div>
                        )}
                    </div>
                </div>
            </a>
            {extLink && (
            <a href={extLink} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800 hover:underline p-4 border-t">
                <span className="font-semibold mr-2">Get Tickets →</span>
            </a>
            )}
        </div>
    );
};