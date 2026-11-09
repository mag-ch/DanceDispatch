import { getEvents, getVenues, getHosts, getUniqueBoroughs, getUsers } from '@/lib/utils_supabase_server';
import SearchClient, { SearchCategory } from './SearchClient';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-metadata';

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

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
    const params = await searchParams;
    const query = firstParam(params?.query);
    const queryLabel = query?.replace(/\s+/g, ' ').slice(0, 80);
    const title = queryLabel ? `Search: ${queryLabel}` : 'Search';
    const description = queryLabel
        ? `Search DanceDispatch for events, venues, hosts, and users matching "${queryLabel}".`
        : 'Search for dance events, venues, hosts, and users on DanceDispatch.';
    const urlParams = new URLSearchParams();
    if (query) urlParams.set('query', query);
    const categories = Array.isArray(params?.categories) ? params.categories : [params?.categories];
    categories.filter((category): category is SearchCategory => typeof category === 'string' && isSearchCategory(category))
        .forEach((category) => urlParams.append('categories', category));
    const search = urlParams.toString();
    const url = search ? `/search?${search}` : '/search';
    return pageMetadata(title, description, url, '/icons/icon_1.png');
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
            initialUsers={users}
            initialBoroughs={boroughs}
            searchBar={queryString}
            categories={parsedCategories}
        />
    );
}