'use server';

export interface Event {
    id: string;
    title: string;
    startdate: string;
    starttime: string;
    enddate: string;
    endtime: string;
    locationid: string;
    location: string;
    description: string;
    price?: number;
    imageurl?: string;
    externallink?: string;
    hostNames?: string[]; 
    hostIDs?: string[]; 
    hostGenres?: string[];
    // Add other fields as needed based on your CSV structure
}
export interface Venue {
    id: string;
    name: string;
    address: string;
    type: string;
    bio: string;
    website: string;
    photourls: string;
    // Add other fields as needed based on your CSV structure
}
export interface Host {
    id: string;
    name: string;
    bio: string;
    photoUrl: string;
    tags: string[];
    genres: string[];
    externalLinks?: HostExternalLink[];
    // Add other fields as needed based on your CSV structure
}

export interface HostExternalLink {
    type?: string;
    url: string;
    embed_code?: string;
}

function inferPlatformFromUrl(url: string): string {
    const normalized = url.toLowerCase();
    if (normalized.includes('soundcloud.com')) return 'soundcloud';
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
    if (normalized.includes('spotify.com')) return 'spotify';
    if (normalized.includes('instagram.com')) return 'instagram';
    if (normalized.includes('mixcloud.com')) return 'mixcloud';
    return 'website';
}

export async function getBoroughFromAddress(address: string): Promise<string> {
    const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
    for (const borough of boroughs) {
        if (address.toLowerCase().includes(borough.toLowerCase())) {
            return borough;
        }
    }
    return 'Unknown';
}

const parseDateOnlyAsLocal = (dateStr: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return new Date(dateStr);

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
};

export async function formatDateOnly(dateStr: string, timeStr?: string) {
    const date = parseDateOnlyAsLocal(dateStr);
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        date.setHours(hours, minutes);
    }
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
};

export interface EventReview {
    eventName: string;
    eventId: string;
    username:string;
    dateSubmitted: string;
     userId?: string;
    user_id?: string;
    mainComment?: string;
    venueReview?: {
        venueName: string;
        rating: number;
        comments: string;
    };
    djReviews?: {
        djName: string;
        rating: number;
        comments: string;
    }[];
    privacyLevel: 'public' | 'private' | 'anonymous';
    mediaPaths?: string[];

}


export async function processUrl(url: string): Promise<string> {
    // strip [ and ] and " and ' from url if present
    url = url.replace(/[\[\]"']/g, '');
    return url;
}


export async function prettifyCase(str: string): Promise<string> {
    return str.slice(0,1).toUpperCase() + str.replace("_", " ").slice(1);
}