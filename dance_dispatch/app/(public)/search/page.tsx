import { getEvents, getVenues, getHosts, getUniqueBoroughs, getUsers } from '@/lib/utils_supabase_server';
import { getTopBadgesForUsers } from '@/lib/server_utils';
import SearchClient, { SearchCategory } from './SearchClient';

type SearchPageProps = {
    searchParams?: Promise<{
        query?: string | string[];
        categories?: string | string[];
    }>;
    searchBar?: string;
    categories?: SearchCategory[];
};

function firstParam(value?: string | string[]): string | undefined {
    if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    if (Array.isArray(value)) {
        const candidate = value.find((item) => typeof item === 'string' && item.trim().length > 0);
        return candidate?.trim();
    }

    return undefined;
}

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
    const userBadgeMap = await getTopBadgesForUsers(
        users.map((user: any) => String(user.id)).filter(Boolean),
        1,
    );
    const usersWithBadges = users.map((user: any) => ({
        ...user,
        topBadges: userBadgeMap[String(user.id)] ?? [],
    }));
    const boroughs = await getUniqueBoroughs();

    const queryString = firstParam(resolvedSearchParams?.query) ?? searchBar ?? '';
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
            initialUsers={usersWithBadges}
            initialBoroughs={boroughs}
            searchBar={queryString}
            categories={parsedCategories}
        />
    );
}