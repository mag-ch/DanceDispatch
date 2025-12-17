'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { EventCard, SearchResult } from '@/app/components/EventCard';
import { Event } from '@/lib/utils';


type SearchCategory = 'events' | 'venues' | 'hosts' | 'users';

interface SearchClientProps {
    initialEvents: any[];
    initialVenues: any[];
    initialHosts: any[];
}

export default function SearchClient({ 
    initialEvents, 
    initialVenues, 
    initialHosts 
}: SearchClientProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategories, setActiveCategories] = useState<SearchCategory[]>([
        'events',
        'venues',
        'hosts',
        'users',
    ]);
    const [dateFilter, setDateFilter] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });

    const toggleCategory = (category: SearchCategory) => {
        setActiveCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        );
    };

    // Filter events based on search query and filters
    let filteredEvents = searchQuery === '' 
        ? initialEvents 
        : initialEvents.filter(event => {
            const matchesQuery = event.title?.toLowerCase().includes(searchQuery.toLowerCase());
            console.log("Event:", event.title);
            console.log("Matches Query:", matchesQuery);
            // Add more filter logic here
            return matchesQuery;
        });
    filteredEvents = dateFilter === '' ? filteredEvents : filteredEvents.filter(event => {
        const eventDate = new Date(event.startdate);
        const filterDate = new Date(dateFilter);
        return eventDate.toDateString() === filterDate.toDateString();
    });
    
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Theme Toggle */}
                <div className="flex justify-end mb-4">
                    <ThemeToggle />
                </div>
                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search events, venues, hosts, and users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                {category}
                            </button>
                        )
                    )}
                </div>

                {/* Event Filters */}
                {activeCategories.includes('events') && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
                        <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Event Filters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
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
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={priceRange.max}
                                        onChange={(e) =>
                                            setPriceRange({ ...priceRange, max: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Results */}
                <div className="space-y-6">
                    {activeCategories.includes('events') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Events</h2>
                            <div className="space-y-3">
                                {filteredEvents.map((event: Event) => (
                                        <SearchResult key={event.id} header={event.title} subheader={event.description} date={event.startdate} price={event.price} location={event.location} />
                                      ))}
                                {filteredEvents.length === 0 && <p className="text-gray-500 dark:text-gray-400">No events found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('venues') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Venues</h2>
                            <div className="space-y-3">
                                {initialVenues.map((venue: any) => (
                                        <SearchResult key={venue.ID} header={venue.name} subheader={venue.description} location={venue.location} />
                                      ))}                                
                                {initialVenues.length === 0 && <p className="text-gray-500 dark:text-gray-400">No venues found</p>}
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('hosts') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Hosts</h2>
                            <div className="space-y-3">
                                {/* Host results will be mapped here */}
                                <p className="text-gray-500 dark:text-gray-400">No hosts found</p>
                            </div>
                        </section>
                    )}

                    {activeCategories.includes('users') && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Users</h2>
                            <div className="space-y-3">
                                {/* User results will be mapped here */}
                                <p className="text-gray-500 dark:text-gray-400">No users found</p>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}