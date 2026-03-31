import { getEvents, getVenues, getHosts, getUniqueBoroughs, getUsers } from '@/lib/utils_supabase_server';
import SearchClient, { SearchCategory } from './SearchClient';

type SearchPageProps = {
    searchParams?: Promise<{
        q?: string | string[];
        query?: string | string[];
        categories?: string | string[];
    }>;
    searchBar?: string;
    categories?: SearchCategory[];
};

function isSearchCategory(value: string): value is SearchCategory {
    return value === 'events' || value === 'venues' || value === 'hosts' || value === 'users';
}

// This is a Server Component (no 'use client')
export default async function SearchPage({ searchParams, searchBar, categories }: SearchPageProps) {
    const resolvedSearchParams = await searchParams;

    // If categories is null/empty, include all categories by default.
    const fallbackCategories: SearchCategory[] =
        categories && categories.length > 0 ? categories : ['events', 'venues', 'hosts', 'users'];

    // Fetch data synchronously on the server using fs
    const events = await getEvents(false);
    const venues = await getVenues();
    const hosts = await getHosts();
    const users = await getUsers();
    const boroughs = await getUniqueBoroughs();

    const rawQuery = resolvedSearchParams?.query ?? resolvedSearchParams?.q;
    const queryString = typeof rawQuery === 'string' ? rawQuery : searchBar ?? '';
    const categoryParams = resolvedSearchParams?.categories;
    const parsedCategories = Array.isArray(categoryParams)
        ? categoryParams.filter((category) => isSearchCategory(category))
        : typeof categoryParams === 'string' && isSearchCategory(categoryParams)
            ? [categoryParams]
            : fallbackCategories.filter((category) => isSearchCategory(category));
    
    // Pass data to Client Component as props
    return (
        <SearchClient 
            initialEvents={events}
            initialVenues={venues}
            initialHosts={hosts}
            initialUsers={users}
            initialBoroughs={boroughs}
            searchBar={queryString}
            categories={parsedCategories}
        />
    );
}