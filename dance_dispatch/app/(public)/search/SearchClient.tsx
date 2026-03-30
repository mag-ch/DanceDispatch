'use client';
import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import { Event } from '@/lib/utils';
import Select from 'react-select';

export type SearchCategory = 'events' | 'venues' | 'hosts' | 'users';

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

    
    const formatEventDate = (dateStr?: string) => {
        if (!dateStr) return 'Date TBD';

        const normalized = dateStr.trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            // Use local noon to avoid DST/UTC boundary shifts.
            return new Date(year, month, day, 12, 0, 0).toDateString();
        }

        const parsed = new Date(normalized);
        console.log('Parsed date:', parsed, 'from input:', normalized);
        return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
    };
    const safeEvents = Array.isArray(initialEvents) ? initialEvents : [];
    const safeVenues = Array.isArray(initialVenues) ? initialVenues : [];
    const safeHosts = Array.isArray(initialHosts) ? initialHosts : [];
    const safeUsers = Array.isArray(initialUsers) ? initialUsers : [];
    const safeBoroughs = Array.isArray(initialBoroughs) ? initialBoroughs : [];

    const [searchQuery, setSearchQuery] = useState(searchBar ?? "");
    const [pastEventsBool, setPastEventsBool] = useState(false);
    const [activeCategories, setActiveCategories] = useState<SearchCategory[]>(categories);
    const [dateFilter, setDateFilter] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [boroughs, setBoroughs] = useState<any[]>([]);

    const boroughOptions = useMemo(() => 
        safeBoroughs.map(borough => ({ value: borough, label: borough })),
        [safeBoroughs]
    );
    // useEffect(() => {
    //     const fetchBoroughs = async () => {
    //         const uniqueBoroughs = await getUniqueBoroughs();
    //         setBoroughs(uniqueBoroughs.map(borough => ({ value: borough, label: borough })));
    //     };
    //     fetchBoroughs();
    // }, [getUniqueBoroughs]);

    const toggleCategory = (category: SearchCategory) => {
        setActiveCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        );
    };

    const handleBoroughChange = (selectedOptions: any) => {
        // Handle borough filter change
        setBoroughs(selectedOptions || []);
    }
    console.log("search query = " +searchQuery);

    // Filter events based on search query and filters
    let filteredEvents = searchQuery === '' 
        ? safeEvents 
        : safeEvents.filter(event => {
            const matchesQuery = event.title?.toLowerCase().includes(searchQuery.toLowerCase());
            // Add more filter logic here
            return matchesQuery;
        });
    filteredEvents = pastEventsBool ? filteredEvents : filteredEvents.filter(event => {
        const eventDate = new Date(event.startdate);
        const now = new Date();
        return eventDate >= now;
    });
    filteredEvents = (priceRange.min === '' && priceRange.max === '') ? filteredEvents : filteredEvents.filter(event => {
        const eventPrice = event.price === undefined ? 0 : event.price;
        const minPrice = priceRange.min === '' ? 0 : parseFloat(priceRange.min);
        const maxPrice = priceRange.max === '' ? Infinity : parseFloat(priceRange.max);
        return (eventPrice >= minPrice && eventPrice <= maxPrice);
    });
    filteredEvents = dateFilter === '' ? filteredEvents : filteredEvents.filter(event => {
        const eventDate = new Date(event.startdate);
        const filterDate = new Date(dateFilter);
        return eventDate.toISOString().split('T')[0] >= filterDate.toISOString().split('T')[0];
    });

    let filteredVenues = searchQuery === '' 
        ? safeVenues 
        : safeVenues.filter(venue => {
            const matchesQuery = venue.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesQuery;
        });
    filteredVenues = boroughs.length === 0 ? filteredVenues : filteredVenues.filter(venue => {
        return boroughs.some(borough => venue.address?.toLowerCase().includes(borough.value.toLowerCase()));
    });
    let filteredHosts = searchQuery === '' 
        ? safeHosts 
        : safeHosts.filter(host => {
            const matchesQuery = host.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesQuery;
        });
    let filteredUsers = Array.isArray(safeUsers) ? safeUsers : [];
    filteredUsers = searchQuery === ''
        ? filteredUsers
        : filteredUsers.filter(user => {
            const matchesQuery = user.username?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesQuery;
        });

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-7xl mx-auto">
                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-text" />
                    <input
                        type="text"
                        placeholder= {"Search " + activeCategories.join(", ") + "..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-surface text-text placeholder-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Category Toggles */}
                <div className="flex flex-wrap gap-2 mb-6 items-center">
                    {(['events', 'venues', 'hosts', 'users'] as SearchCategory[]).map(
                        (category) => (
                            <button
                                key={category}
                                onClick={() => toggleCategory(category)}
                                className={`px-4 py-2 rounded-full font-medium capitalize transition-colors ${
                                    activeCategories.includes(category)
                                        ? ' btn-highlighted bg-blue-600 text-white'
                                        : 'bg-gray-200 text-text hover:bg-gray-300'
                                }`}
                            >
                                {category}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => setActiveCategories([])}
                        className="flex items-center px-3 py-2 rounded-full bg-gray-200 text-text hover:bg-gray-300 ml-2"
                        title="Clear all"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear all
                    </button>
                </div>

                {/* Main Layout with Sidebar */}
                <div className="flex gap-6">
                    {/* Sidebar - Filters */}
                    <aside className="w-64 flex-shrink-0">
                        <div className="bg-surface rounded-lg shadow p-4 sticky top-8">
                            <h2 className="text-lg font-bold mb-4 text-text">Filters</h2>
                            
                            {/* Category-specific Filters */}
                            {activeCategories.includes('events') && (
                                <div className="mb-6">
                                    <h3 className="font-semibold mb-3 text-text">Event Filters</h3>
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-sm font-medium text-text">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    setPastEventsBool(e.target.checked);
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            Include past events
                                        </label>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text">Date</label>
                                            <input
                                                type="date"
                                                value={dateFilter}
                                                onChange={(e) => {
                                                    setDateFilter(e.target.value);
                                                    if (new Date(e.target.value) < new Date()) {
                                                        setPastEventsBool(true);
                                                    }
                                                    else {
                                                        setPastEventsBool(false);
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text">
                                                Price Range
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={priceRange.min}
                                                    onChange={(e) =>
                                                        setPriceRange({ ...priceRange, min: e.target.value })
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text placeholder-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={priceRange.max}
                                                    onChange={(e) =>
                                                        setPriceRange({ ...priceRange, max: e.target.value })
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-surface text-text placeholder-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCategories.includes('venues') && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-text">Venue Filters</h3>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-text">Boroughs</label>
                                        <Select
                                            isMulti
                                            options={boroughOptions}
                                            onChange={(e) => setBoroughs(e ? [...e] : [])}
                                            className="bg-surface text-text text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Search Results */}
                    <div className="flex-1 space-y-6">
                    {activeCategories.includes('events') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-text">Events</h2>
                            <div className="space-y-3">
                                {filteredEvents.map((event: Event, index: number) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={formatEventDate(event.startdate) + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events"/>
                                      ))}
                                {filteredEvents.length === 0 && <p className="text-text">No events found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('venues') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-text">Venues</h2>
                            <div className="space-y-3">
                                {filteredVenues.map((venue: any, index: number) => (
                                        <SearchResult key={`${venue.id}-${index}`} header={venue.name} subheader={venue.type} location={venue.address} img={venue.photourls} entityId={venue.id} entity="venues"/>
                                      ))}                                
                                {filteredVenues.length === 0 && <p className="text-text">No venues found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('hosts') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-text">Hosts</h2>
                            <div className="space-y-3">
                            {filteredHosts.map((host: any, index: number) => (
                                <SearchResult 
                                    key={`${host.id}-${index}`} 
                                    header={host.name} 
                                    subheader={Array.isArray(host.tags) ? host.tags.join(', ') : null} 
                                    location={host.address} 
                                    img={host.photoUrl} 
                                    entityId={host.id} 
                                    entity="hosts"
                                />
                            ))}
                                {filteredHosts.length === 0 && <p className="text-text">No hosts found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('users') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-text">Users</h2>
                            <div className="space-y-3">
                                {filteredUsers.map((user: any, index: number) => {
                                    let createdAtString = '';
                                    if (user.created_at) {
                                        const date = new Date(user.created_at);
                                        createdAtString = isNaN(date.getTime()) ? '' : "Joined " + date.toLocaleDateString();
                                    }
                                    return (
                                        <SearchResult
                                            key={`${user.id}-${index}`}
                                            header={user.username}
                                            subheader={createdAtString}
                                            img={user.profile_picture}
                                            entityId={user.id}
                                            entity="users"
                                        />
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