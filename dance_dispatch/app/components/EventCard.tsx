import React from 'react';

interface Event {
    id: string;
    title: string;
    description: string;
    startDateTime: Date;
    endDateTime: Date;
    location: string;
    price: number;
    thumbnailUrl?: string;
}

interface EventCardProps {
    event: Event;
}

interface SearchResultProps {
    header: string;
    subheader: string;
    date?: string;
    price?: number;
    location?: string;
}

export const SearchResult: React.FC<SearchResultProps> = ({ 
    header, 
    subheader, 
    date, 
    price, 
    location 
}) => {
    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(date));
    };

    return (
        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-xl">📅</span>
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
    );
};

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
    const defaultThumbnail = event.thumbnailUrl ?? '/images/default_event.jpg';
    
    const formatDateTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
    };

    const truncateDescription = (text: string, maxLength: number = 100) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className="w-full bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <img
                src={event.thumbnailUrl || defaultThumbnail}
                alt={event.title}
                className="w-full h-48 object-cover"
            />
            <div className="p-4">
                <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                <p className="text-gray-600 text-sm mb-3">
                    {event.description ? truncateDescription(event.description):""}
                </p>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-700">
                        <span className="font-semibold mr-2">Start:</span>
                        {formatDateTime(event.startDateTime)}
                    </div>
                    <div className="flex items-center text-gray-700">
                        <span className="font-semibold mr-2">End:</span>
                        {formatDateTime(event.endDateTime)}
                    </div>
                    <div className="flex items-center text-gray-700">
                        <span className="font-semibold mr-2">Location:</span>
                        {event.location}
                    </div>
                    <div className="flex items-center text-gray-900 font-bold">
                        <span className="mr-2">Price:</span>
                        ${event.price}
                    </div>
                </div>
            </div>
        </div>
    );
};