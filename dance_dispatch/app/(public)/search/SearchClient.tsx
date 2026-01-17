'use client';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import { Event, getUniqueBoroughs } from '@/lib/utils';
import Select from 'react-select';

type SearchCategory = 'events' | 'venues' | 'hosts' | 'users';

interface SearchClientProps {
    initialEvents: any[];
    initialVenues: any[];
    initialHosts: any[];
    initalBoroughs: any[];
}

export default function SearchClient({ 
    initialEvents, 
    initialVenues, 
    initialHosts,
    initalBoroughs
}: SearchClientProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [pastEventsBool, setPastEventsBool] = useState(false);
    const [activeCategories, setActiveCategories] = useState<SearchCategory[]>([
        'events',
        'venues',
        'hosts',
        'users',
    ]);
    const [dateFilter, setDateFilter] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [boroughs, setBoroughs] = useState<any[]>([]);

    initalBoroughs = initalBoroughs.map(borough => ({ value: borough, label: borough }))
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

    // Filter events based on search query and filters
    let filteredEvents = searchQuery === '' 
        ? initialEvents 
        : initialEvents.filter(event => {
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
        const eventPrice = parseFloat(event.price);
        const minPrice = priceRange.min === '' ? 0 : parseFloat(priceRange.min);
        const maxPrice = priceRange.max === '' ? Infinity : parseFloat(priceRange.max);
        return (isNaN(eventPrice)) || (eventPrice >= minPrice && eventPrice <= maxPrice);
    });
    filteredEvents = dateFilter === '' ? filteredEvents : filteredEvents.filter(event => {
        const eventDate = new Date(event.startdate);
        const filterDate = new Date(dateFilter);
        return eventDate.toISOString().split('T')[0] === filterDate.toISOString().split('T')[0];
    });

    let filteredVenues = searchQuery === '' 
        ? initialVenues 
        : initialVenues.filter(venue => {
            const matchesQuery = venue.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesQuery;
        });
    filteredVenues = boroughs.length === 0 ? filteredVenues : filteredVenues.filter(venue => {
        return boroughs.some(borough => venue.address?.toLowerCase().includes(borough.value.toLowerCase()));
    });
    let filteredHosts = searchQuery === '' 
        ? initialHosts 
        : initialHosts.filter(host => {
            const matchesQuery = host.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesQuery;
        });

   

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Theme Toggle
                <div className="flex justify-end mb-4">
                    <ThemeToggle />
                </div> */}
                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder= {"Search " + activeCategories.join(", ") + "..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white  text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Category Toggles */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {(['events', 'venues', 'hosts', 'users'] as SearchCategory[]).map(
                        (category) => (
                            <button
                                key={category}
                                onClick={() => toggleCategory(category)}
                                className={`px-4 py-2 rounded-full font-medium capitalize transition-colors ${
                                    activeCategories.includes(category)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {category}
                            </button>
                        )
                    )}
                </div>
                <div className="bg-gray-100 rounded-lg p-4 mb-6">
                {/* Category-specific Filters */}
                {activeCategories.includes('events') && (
                    <div className="mb-4">
                        <h3 className="font-semibold mb-3 text-gray-900">Event Filters</h3>
                        <div className="mb-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            setPastEventsBool(e.target.checked);
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    Include past events
                                </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">Date</label>
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 "
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={priceRange.max}
                                        onChange={(e) =>
                                            setPriceRange({ ...priceRange, max: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeCategories.includes('venues') && (
                    <div>
                        <h3 className="font-semibold mb-3 text-gray-900">Venue Filters</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">Boroughs</label>
                            <Select
                                isMulti
                                options={initalBoroughs}
                                onChange={(e) => setBoroughs(e ? [...e] : [])}
                                className="text-gray-900"
                            />
                        </div>
                    </div>
                )}
                </div>

                {/* Search Results */}
                <div className="space-y-6">
                    {activeCategories.includes('events') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900">Events</h2>
                            <div className="space-y-3">
                                {filteredEvents.map((event: Event, index: number) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} route={`/events/${event.id}`}/>
                                      ))}
                                {filteredEvents.length === 0 && <p className="text-gray-500">No events found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('venues') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900">Venues</h2>
                            <div className="space-y-3">
                                {filteredVenues.map((venue: any, index: number) => (
                                        <SearchResult key={`${venue.id}-${index}`} header={venue.name} subheader={venue.description} location={venue.address} img={venue.imageurl} route={`/venues/${venue.id}`}/>
                                      ))}                                
                                {filteredVenues.length === 0 && <p className="text-gray-500">No venues found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('hosts') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900">Hosts</h2>
                            <div className="space-y-3">
                              {filteredHosts.map((host: any, index: number) => (
                                        <SearchResult key={`${host.id}-${index}`} header={host.name} subheader={host.description} location={host.address} img={host.imageurl} route={`/hosts/${host.id}`}/>
                                      ))}                                
                                {filteredHosts.length === 0 && <p className="text-gray-500">No hosts found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('users') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900">Users</h2>
                            <div className="space-y-3">
                                {/* User results will be mapped here */}
                                <p className="text-gray-500">No users found</p>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}