'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
    photourls: string;
    venueName: string;
}

export default function VenueImageGallery({ photourls, venueName }: Props) {
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const photos = photourls.split(',');

    return (
        <div className="relative h-96 bg-bg">
            <Image
                src={photos[activeImageIndex] || '/images/default_venue.jpg'}
                alt={venueName}
                fill
                className="object-cover"
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
                {photos.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-2 h-2 rounded-full ${
                            idx === activeImageIndex ? 'bg-white' : 'bg-gray-400'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}
