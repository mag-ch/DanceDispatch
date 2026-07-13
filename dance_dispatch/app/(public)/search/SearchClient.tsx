'use client';
import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import { Event } from '@/lib/utils';
import Select from 'react-select';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type SearchCategory = 'events' | 'venues' | 'hosts' | 'users';
const ALL_CATEGORIES: SearchCategory[] = ['events', 'venues', 'hosts', 'users'];

function isSearchCategory(value: string): value is SearchCategory {
    return value === 'events' || value === 'venues' || value === 'hosts' || value === 'users';
}

interface SearchClientProps {
    initialEvents: any[];
    initialVenues: any[];
    initialHosts: any[];
    initialUsers: any[];
    initialBoroughs: any[];
    categories: SearchCategory[];
    searchBar: string;
}

export default function SearchClient({ 
    initialEvents, 
    initialVenues, 
    initialHosts,
    initialUsers,
    initialBoroughs,
    categories,
    searchBar
}: SearchClientProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const formatEventDate = (dateStr?: string) => {
        if (!dateStr) return 'Date TBD';
        const normalized = dateStr.trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            return new Date(year, month, day, 12, 0, 0).toDateString();
        }
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
    };

    const safeEvents = Array.isArray(initialEvents) ? initialEvents : [];
    const safeVenues = Array.isArray(initialVenues) ? initialVenues : [];
    const safeHosts = Array.isArray(initialHosts) ? initialHosts : [];
    const safeUsers = Array.isArray(initialUsers) ? initialUsers : [];
    const safeBoroughs = Array.isArray(initialBoroughs) ? initialBoroughs : [];

    // Build a venueId → venue lookup map once
    const venueMap = useMemo(() => {
        const map = new Map<string | number, any>();
        for (const venue of safeVenues) {
            if (venue.id != null) map.set(venue.id, venue);
        }
        return map;
    }, [safeVenues]);

    const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? searchBar ?? '');
    const [pastEventsBool, setPastEventsBool] = useState(() => searchParams?.get('includePast') === 'true');
    const [activeCategories, setActiveCategories] = useState<SearchCategory[]>(() => {
        const fromUrl = searchParams?.getAll('categories') ?? [];
        const valid = fromUrl.filter((category) => isSearchCategory(category));
        return valid.length > 0 ? valid : categories;
    });

    const [dateStart, setDateStart] = useState(() => searchParams?.get('dateStart') ?? '');
    const [dateEnd, setDateEnd] = useState(() => searchParams?.get('dateEnd') ?? '');

    const [priceRange, setPriceRange] = useState(() => ({
        min: searchParams?.get('minPrice') ?? '',
        max: searchParams?.get('maxPrice') ?? '',
    }));
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [selectedBoroughs, setSelectedBoroughs] = useState<any[]>(() => {
        const fromUrl = searchParams?.getAll('boroughs') ?? [];
        return fromUrl.map((borough) => ({ value: borough, label: borough }));
    });

    const displayCategories = activeCategories.length === 0 ? ALL_CATEGORIES : activeCategories;

    const boroughOptions = useMemo(() =>
        safeBoroughs.map(borough => ({ value: borough, label: borough })),
        [safeBoroughs]
    );

    const parseDateInput = (val: string): Date | null => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    };

    const handleDateStartChange = (val: string) => {
        setDateStart(val);
        if (val) {
            const d = parseDateInput(val);
            setPastEventsBool(d ? d < new Date() : false);
        } else if (!dateEnd) {
            setPastEventsBool(false);
        }
    };

    const handleDateEndChange = (val: string) => {
        setDateEnd(val);
        if (val) {
            const d = parseDateInput(val);
            setPastEventsBool(d ? d < new Date() : false);
        } else if (!dateStart) {
            setPastEventsBool(false);
        }
    };

    // Returns true if a venue's address matches any selected borough
    const venueMatchesBoroughs = (venue: any): boolean => {
        if (selectedBoroughs.length === 0) return true;
        return selectedBoroughs.some(b =>
            venue?.address?.toLowerCase().includes(b.value.toLowerCase())
        );
    };

    useEffect(() => {
        const nextParams = new URLSearchParams();

        const query = searchQuery.trim();
        if (query) nextParams.set('query', query);

        const hasAllCategoriesSelected =
            activeCategories.length === ALL_CATEGORIES.length &&
            ALL_CATEGORIES.every((category) => activeCategories.includes(category));

        if (!hasAllCategoriesSelected) {
            for (const category of activeCategories) {
                nextParams.append('categories', category);
            }
        }

        if (pastEventsBool) nextParams.set('includePast', 'true');
        if (dateStart) nextParams.set('dateStart', dateStart);
        if (dateEnd) nextParams.set('dateEnd', dateEnd);
        if (priceRange.min !== '') nextParams.set('minPrice', priceRange.min);
        if (priceRange.max !== '') nextParams.set('maxPrice', priceRange.max);

        for (const borough of selectedBoroughs) {
            const value = String(borough?.value ?? '').trim();
            if (value) nextParams.append('boroughs', value);
        }

        const currentQuery = searchParams?.toString() ?? '';
        const nextQuery = nextParams.toString();
        if (nextQuery === currentQuery) return;

        const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.replace(nextHref, { scroll: false });
    }, [activeCategories, selectedBoroughs, dateStart, dateEnd, pathname, pastEventsBool, priceRange.max, priceRange.min, router, searchParams, searchQuery]);

    const toggleCategory = (category: SearchCategory) => {
        setActiveCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        );
    };

    const now = new Date();

    const eventEndTime = (event: any) => {
        const dateStr = event.enddate || event.startdate;
        const timeStr = event.endtime;
        if (dateStr && timeStr) return new Date(`${dateStr.split('T')[0]}T${timeStr}`);
        return new Date(dateStr);
    };

    const eventStartDay = (event: any): Date => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(event.startdate ?? '');
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
        return new Date(event.startdate);
    };

    // ── Events ──────────────────────────────────────────────────────────────
    let filteredEvents = searchQuery === ''
        ? safeEvents
        : safeEvents.filter(event =>
            event.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    if (pastEventsBool) {
        filteredEvents = filteredEvents
            .filter(event => eventEndTime(event) < now)
            .sort((a, b) => eventEndTime(b).getTime() - eventEndTime(a).getTime());
    } else {
        filteredEvents = filteredEvents.filter(event => eventEndTime(event) >= now);
    }

    if (priceRange.min !== '' || priceRange.max !== '') {
        filteredEvents = filteredEvents.filter(event => {
            const eventPrice = event.price ?? 0;
            const minPrice = priceRange.min === '' ? 0 : parseFloat(priceRange.min);
            const maxPrice = priceRange.max === '' ? Infinity : parseFloat(priceRange.max);
            return eventPrice >= minPrice && eventPrice <= maxPrice;
        });
    }

    if (dateStart || dateEnd) {
        const startBound = dateStart ? parseDateInput(dateStart) : null;
        const endBound = dateEnd ? parseDateInput(dateEnd) : null;
        filteredEvents = filteredEvents.filter(event => {
            const evDay = eventStartDay(event);
            if (startBound && evDay < startBound) return false;
            if (endBound && evDay > endBound) return false;
            return true;
        });
    }

    // Borough filter for events: resolve venueId → venue → address
    if (selectedBoroughs.length > 0) {
        filteredEvents = filteredEvents.filter(event => {
            const venue = venueMap.get(event.locationid);
            return venueMatchesBoroughs(venue);
        });
    }

    // ── Venues ──────────────────────────────────────────────────────────────
    let filteredVenues = searchQuery === ''
        ? safeVenues
        : safeVenues.filter(venue =>
            venue.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    if (selectedBoroughs.length > 0) {
        filteredVenues = filteredVenues.filter(venue => venueMatchesBoroughs(venue));
    }

    // ── Hosts ────────────────────────────────────────────────────────────────
    let filteredHosts = searchQuery === ''
        ? safeHosts
        : safeHosts.filter(host =>
            host.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    // ── Users ────────────────────────────────────────────────────────────────
    let filteredUsers = Array.isArray(safeUsers) ? safeUsers : [];
    filteredUsers = searchQuery === ''
        ? filteredUsers
        : filteredUsers.filter(user =>
            user.username?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    return (
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
            <div className="max-w-7xl mx-auto">
                {/* Search Bar */}
                <div className="relative mb-4 sm:mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-text" />
                    <input
                        type="text"
                        placeholder={"Search " + displayCategories.join(", ") + "..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg bg-surface text-text placeholder-text text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Category Toggles */}
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 items-center">
                    {ALL_CATEGORIES.map((category) => (
                        <button
                            key={category}
                            onClick={() => toggleCategory(category)}
                            className={`px-3 sm:px-4 py-2 rounded-full font-medium capitalize text-sm sm:text-base transition-colors ${
                                activeCategories.includes(category)
                                    ? 'btn-highlighted bg-blue-600 text-white'
                                    : 'bg-gray-200 text-text hover:bg-gray-300'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                    <button
                        onClick={() => setActiveCategories([])}
                        className="flex items-center px-3 py-2 rounded-full bg-gray-200 text-text hover:bg-gray-300 text-sm sm:text-base"
                        title="Clear all"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear all
                    </button>
                </div>

                <div className="mb-4 lg:hidden">
                    <button
                        onClick={() => setMobileFiltersOpen((prev) => !prev)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-surface text-text font-medium text-sm"
                        type="button"
                        aria-expanded={mobileFiltersOpen}
                        aria-controls="search-mobile-filters"
                    >
                        {mobileFiltersOpen ? 'Hide filters' : 'Show filters'}
                    </button>
                </div>

                {/* Main Layout */}
                <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                    {/* Sidebar */}
                    <aside
                        id="search-mobile-filters"
                        className={`${mobileFiltersOpen ? 'block' : 'hidden'} w-full lg:block lg:w-72 lg:flex-shrink-0`}
                    >
                        <div className="bg-surface rounded-lg shadow p-4 sm:p-5 lg:sticky lg:top-8">
                            <h2 className="text-lg font-bold mb-4 text-text">Filters</h2>

                            {displayCategories.includes('events') && (
                                <div className="mb-6">
                                    <h3 className="font-semibold mb-3 text-text">Event Filters</h3>
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-sm font-medium text-text">
                                            <input
                                                type="checkbox"
                                                checked={pastEventsBool}
                                                onChange={(e) => setPastEventsBool(e.target.checked)}
                                                className="rounded border-gray-300"
                                            />
                                            View past events
                                        </label>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text">Date Range</label>
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <span className="text-xs text-gray-500 mb-0.5 block">From</span>
                                                    <input
                                                        type="date"
                                                        value={dateStart}
                                                        max={dateEnd || undefined}
                                                        onChange={(e) => handleDateStartChange(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 mb-0.5 block">To</span>
                                                    <input
                                                        type="date"
                                                        value={dateEnd}
                                                        min={dateStart || undefined}
                                                        onChange={(e) => handleDateEndChange(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                {(dateStart || dateEnd) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDateStart('');
                                                            setDateEnd('');
                                                            setPastEventsBool(false);
                                                        }}
                                                        className="text-xs text-blue-500 hover:text-blue-700 text-left"
                                                    >
                                                        Clear dates
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text">Price Range</label>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={priceRange.min}
                                                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text placeholder-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={priceRange.max}
                                                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text placeholder-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            
                            {/* Borough filter — shown whenever events or venues are active */}
                            {(displayCategories.includes('events') || displayCategories.includes('venues')) && (
                                <div className="mb-6">
                                    <h3 className="font-semibold mb-3 text-text">Location</h3>
                                    <label className="block text-sm font-medium mb-1 text-text">Boroughs</label>
                                    <Select
                                        isMulti
                                        options={boroughOptions}
                                        value={selectedBoroughs}
                                        onChange={(e) => setSelectedBoroughs(e ? [...e] : [])}
                                        placeholder="All boroughs"
                                        className="bg-surface text-text text-sm"
                                        styles={{
                                            control: (base) => ({ ...base, backgroundColor: 'rgb(var(--surface))' }),
                                            menu: (base) => ({ ...base, backgroundColor: 'rgb(var(--surface))' }),
                                            menuList: (base) => ({ ...base, backgroundColor: 'rgb(var(--surface))' }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected
                                                    ? 'rgba(37, 99, 235, 0.75)'
                                                    : state.isFocused
                                                        ? 'rgba(37, 99, 235, 0.35)'
                                                        : 'transparent',
                                                color: 'rgb(var(--text))',
                                            }),
                                        }}
                                    />
                                </div>
                            )}

                        </div>
                    </aside>

                    {/* Search Results */}
                    <div className="flex-1 min-w-0 space-y-5 sm:space-y-6">
                        {displayCategories.includes('events') && (
                            <section>
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-text">Events</h2>
                                {filteredEvents.length === 0 && <p className="text-text">No events found</p>}
                                {(() => {
                                    const groups: { dateLabel: string; events: typeof filteredEvents }[] = [];
                                    for (const event of filteredEvents) {
                                        const label = formatEventDate(event.startdate);
                                        const last = groups[groups.length - 1];
                                        if (last && last.dateLabel === label) {
                                            last.events.push(event);
                                        } else {
                                            groups.push({ dateLabel: label, events: [event] });
                                        }
                                    }
                                    return groups.map((group) => (
                                        <div key={group.dateLabel} className="mb-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group.dateLabel}</p>
                                            <div className="space-y-3">
                                                {group.events.map((event: Event, index: number) => (
                                                    <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={formatEventDate(event.startdate) + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" />
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </section>
                        )}

                        {displayCategories.includes('venues') && (
                            <section>
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-text">Venues</h2>
                                <div className="space-y-3">
                                    {filteredVenues.map((venue: any, index: number) => (
                                        <SearchResult key={`${venue.id}-${index}`} header={venue.name} subheader={venue.type} location={venue.address} img={venue.photourls} entityId={venue.id} entity="venues" />
                                    ))}
                                    {filteredVenues.length === 0 && <p className="text-text">No venues found</p>}
                                </div>
                            </section>
                        )}

                        {displayCategories.includes('hosts') && (
                            <section>
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-text">Hosts</h2>
                                <div className="space-y-3">
                                    {filteredHosts.map((host: any, index: number) => (
                                        <SearchResult key={`${host.id}-${index}`} header={host.name} subheader={Array.isArray(host.tags) ? host.tags.join(', ') : null} location={host.address} img={host.photoUrl} entityId={host.id} entity="hosts" />
                                    ))}
                                    {filteredHosts.length === 0 && <p className="text-text">No hosts found</p>}
                                </div>
                            </section>
                        )}

                        {displayCategories.includes('users') && (
                            <section>
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-text">Users</h2>
                                <div className="space-y-3">
                                    {filteredUsers.map((user: any, index: number) => {
                                        let createdAtString = '';
                                        if (user.created_at) {
                                            const date = new Date(user.created_at);
                                            createdAtString = isNaN(date.getTime()) ? '' : "Joined " + date.toLocaleDateString();
                                        }
                                        return (
                                            <SearchResult key={`${user.id}-${index}`} header={user.username} subheader={createdAtString} img={user.profile_picture} entityId={user.id} entity="users" />
                                        );
                                    })}
                                    {filteredUsers.length === 0 && <p className="text-text">No users found</p>}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}