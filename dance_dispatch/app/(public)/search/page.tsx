import { getEvents, getVenues, getHosts, getUniqueBoroughs, getUsers } from '@/lib/utils_supabase_server';
import SearchClient from './SearchClient';

// This is a Server Component (no 'use client')
export default async function SearchPage() {
    // Fetch data synchronously on the server using fs
    const events = await getEvents(false);
    const venues = await getVenues();
    const hosts = await getHosts();
    const users = await getUsers();
    const boroughs = await getUniqueBoroughs();
    
    // Pass data to Client Component as props
    return (
        <SearchClient 
            initialEvents={events}
            initialVenues={venues}
            initialHosts={hosts}
            initialUsers={users}
            initialBoroughs={boroughs}
        />
    );
}