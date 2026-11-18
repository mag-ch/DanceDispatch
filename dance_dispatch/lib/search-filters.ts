import { isUpcoming } from '@/lib/date-utils';
import type { Event } from '@/lib/utils';

export type SearchCategory = 'events' | 'venues' | 'hosts' | 'users';
export const ALL_CATEGORIES: SearchCategory[] = ['events', 'venues', 'hosts', 'users'];

export type SearchFilters = {
    query: string;
    includePast: boolean;
    categories: SearchCategory[];
    dateStart: string;
    dateEnd: string;
    minPrice: string;
    maxPrice: string;
    boroughs: string[];
};

const FILTER_KEYS = ['query', 'includePast', 'categories', 'dateStart', 'dateEnd', 'minPrice', 'maxPrice', 'boroughs'];

export function readSearchFilters(
    params: URLSearchParams,
    fallbackQuery = '',
    fallbackCategories: SearchCategory[] = ALL_CATEGORIES,
): SearchFilters {
    const categoryParams = params.getAll('categories');
    const categories = categoryParams.filter((category): category is SearchCategory =>
        ALL_CATEGORIES.some((candidate) => candidate === category));
    return {
        query: params.get('query') ?? fallbackQuery,
        includePast: params.get('includePast') === 'true',
        categories: categoryParams.includes('none') ? [] : categories.length ? categories : fallbackCategories,
        dateStart: params.get('dateStart') ?? '',
        dateEnd: params.get('dateEnd') ?? '',
        minPrice: params.get('minPrice') ?? '',
        maxPrice: params.get('maxPrice') ?? '',
        boroughs: params.getAll('boroughs'),
    };
}

export function writeSearchFilters(params: URLSearchParams, filters: SearchFilters): URLSearchParams {
    const next = new URLSearchParams(params);
    for (const key of FILTER_KEYS) next.delete(key);
    if (filters.query) next.set('query', filters.query);
    if (filters.includePast) next.set('includePast', 'true');
    if (filters.categories.length === 0) next.set('categories', 'none');
    else if (filters.categories.length !== ALL_CATEGORIES.length ||
        !ALL_CATEGORIES.every((category) => filters.categories.includes(category))) {
        for (const category of filters.categories) next.append('categories', category);
    }
    if (filters.dateStart) next.set('dateStart', filters.dateStart);
    if (filters.dateEnd) next.set('dateEnd', filters.dateEnd);
    if (filters.minPrice !== '') next.set('minPrice', filters.minPrice);
    if (filters.maxPrice !== '') next.set('maxPrice', filters.maxPrice);
    for (const borough of filters.boroughs) {
        if (borough.trim()) next.append('boroughs', borough);
    }
    return next;
}

export function filterEventsByTime(events: Event[], includePast: boolean, now = new Date()): Event[] {
    return events.filter((event) => isUpcoming(event, now) !== includePast).sort((a, b) => {
        const key = (event: Event) => `${event.startdate}T${event.starttime || '00:00:00'}`;
        return includePast ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b));
    });
}
