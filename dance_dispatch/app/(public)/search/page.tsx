import { getEvents, getVenues, getHosts } from '@/lib/utils';
import SearchClient from './SearchClient';

// This is a Server Component (no 'use client')
export default async function SearchPage() {
    // Fetch data synchronously on the server using fs
    const events = await getEvents();
    const venues = await getVenues();
    const hosts = await getHosts();
    
    // Pass data to Client Component as props
    return (
        <SearchClient 
            initialEvents={events}
            initialVenues={venues}
            initialHosts={hosts}
        />
    );
}