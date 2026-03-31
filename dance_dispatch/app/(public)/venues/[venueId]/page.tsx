import { MapPin, Calendar, Star } from 'lucide-react';
import { getUniqueVenueAttributes, getAggregatedVenueAttributes, getVenueComments } from '@/lib/server_utils';
import { SearchResult } from '@/app/components/EventCard';
import { getCachedVenues, getCachedEvents } from '@/lib/utils_supabase_server';
import { notFound } from 'next/navigation';
import VenueImageGallery from './VenueImageGallery';
import { prettifyCase } from '@/lib/utils';
import VenueRefreshButton from '@/app/components/VenueRefreshButton';
import { FollowEntityButton } from '@/app/components/SaveEventButton';


export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = await params;

    const [venues, allEvents] = await Promise.all([
        getCachedVenues(),
        getCachedEvents(false, venueId),
    ]);

    const [uniqueVenueAttributes, aggregatedVenueAttributes] = await Promise.all([
        getUniqueVenueAttributes(venueId),
        getAggregatedVenueAttributes(venueId),
    ]);

    const venueComments = await getVenueComments(venueId);

    const venue = venues.find(v => v.id === venueId);
    if (!venue) return notFound();

    const now = new Date();
    const pastEvents = allEvents
        .filter(event => new Date(`${event.startdate} ${event.starttime}`) < now)
        .sort((a, b) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
        .slice(0, 5);
    const upcomingEvents = allEvents.filter(event => new Date(`${event.startdate} ${event.starttime}`) >= now);
    const similarVenues = venues.filter(v => v.type === venue.type && v.id !== venueId).slice(0, 5);

    return (
        <div className="min-h-screen bg-bg text-text">
            {/* Image Gallery */}
            {venue.photourls && <VenueImageGallery photourls={venue.photourls} venueName={venue.name} />}

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div>
                                    <h2 className="text-sm text-text uppercase">{venue.type}</h2>
                                    <h1 className="text-4xl text-text font-bold mt-2">{venue.name}</h1>
                                </div>
                                <FollowEntityButton entity="venues" entityId={venue.id} />
                            </div>
                        </section>
                        {/* External Link */}
                        {venue.website && (
                            <section className="mb-4 bg-surface p-6 rounded-lg">
                                <a
                                    href={venue.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 font-semibold transition"
                                >
                                    Visit Website
                                    <span>↗</span>
                                </a>
                            </section>
                        )}

                        {/* Bio */}
                        {venue.bio && <section className="mb-4 bg-surface p-6 rounded-lg">
                            <h2 className="font-semibold text-text text-lg mb-2">Bio</h2>
                            <p className="text-text">{venue.bio}</p>
                        </section>}


                        {/* Address & Map */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            <div className="flex items-start gap-4 mb-2">
                                <MapPin className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-text text-lg">Address</h2>
                                    <p className="text-text">{venue.address}</p>
                                </div>
                            </div>
                            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                                <iframe
                                    width="100%"
                                    height="300"
                                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(venue.address)}`}
                                    className="rounded"
                                    loading="lazy"
                                />
                            ) : (
                                <p className="text-sm text-text">Map not available</p>
                            )}
                        </section>


                        {/* Attributes */}
                        <div className="grid md:grid-cols-2 gap-8 mb-4">
                            {/* Unique Attributes */}
                            {uniqueVenueAttributes && uniqueVenueAttributes.length > 0 && <section className="bg-surface p-6 rounded-lg">
                                <ul className="text-text">
                                    {uniqueVenueAttributes.map((attr, index) => (
                                        <li key={index} className='font-bold text-white px-2 py-1 rounded m-2 hover:opacity-80 transition w-fit' style={{ backgroundColor: `hsl(${Math.random() * 360}, 40%, 50%)` }}>{prettifyCase(attr.attribute)}: {attr.value}</li>
                                    ))}
                                </ul>
                            </section>}

                            {/* Rating Attributes */}
                            {aggregatedVenueAttributes && aggregatedVenueAttributes.length > 0 && <section className="bg-surface p-6 rounded-lg">
                                <ul className="text-text">
                                    {aggregatedVenueAttributes.map((attr, index) => (
                                        <li key={index}>{prettifyCase(attr.attribute)}: {'★'.repeat(Math.round(attr.average))}{'☆'.repeat(5 - Math.round(attr.average))} ({attr.average}/5)</li>
                                    ))}
                                </ul>
                            </section>}
                        </div>


                        {/* Comments section */}

                        {venueComments && venueComments.length > 0 && (
                            <section className="mb-4 bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-2">Comments</h2>
                                <ul className="text-text">
                                    {venueComments.map((comment, index) => (
                                        <div className="flex-shrink-0 min-w-[200px] max-w-[250px]">
                                            <h4 className="text-sm font-semibold text-text mb-2">{comment.privacy_level === 'public' ? comment.user_id : 'Anon'}</h4>
                                            {comment.rating && comment.rating > 0 && (
                                                <div className="flex gap-1 mb-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        size={16}
                                                        className={star <= (comment.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                                    />
                                                ))}
                                            </div>
                                            )}
                                            {comment.comment && (
                                                <p className="text-sm text-text">{comment.comment}</p>
                                            )}
                                        </div>
                                    ))}
                                </ul>

                            </section>
                        )}


                        {/* Events */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Upcoming Events */}
                            <section className="bg-surface p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                    <h2 className="font-semibold text-text text-lg">Upcoming Events</h2>
                                </div>
                                <div className="space-y-3">
                                    {upcomingEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" />

                                        // <div key={event.id} className="border-l-4 border-purple-500 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">
                                        //         {event.startdate} at {event.starttime}
                                        //     </p>
                                        // </div>
                                    ))}
                                </div>
                            </section>

                            {/* Recent Events */}
                            <section className="bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-2">Recent Events</h2>
                                <div className="space-y-3">
                                    {pastEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" />
                                        // <div key={event.id} className="border-l-4 border-gray-300 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">{event.startdate}</p>
                                        // </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div>
                        <section className="bg-surface p-6 rounded-lg sticky top-4">
                            <h2 className="font-semibold text-text text-lg mb-2">Similar Venues</h2>
                            <div className="space-y-4">
                                {similarVenues.map((v) => (

                                    <a key={v.id} href={`/venues/${v.id}`} className="block hover-bg-accent-soft p-3 rounded border border-default hover:border-accent transition">
                                        <p className="font-medium text-text">{v.name}</p>
                                        <p className="text-sm text-text">{v.type}</p>
                                    </a>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}