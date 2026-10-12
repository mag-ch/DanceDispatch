import { MapPin, Calendar, Star } from 'lucide-react';
import { getUniqueVenueAttributes, getAggregatedVenueAttributes, getVenueAttributes, getVenueComments } from '@/lib/server_utils';
import { SearchResult } from '@/app/components/EventCard';
import Link from 'next/link';
import { getCachedVenues, getCachedEvents } from '@/lib/utils_supabase_server';
import { notFound } from 'next/navigation';
import VenueImageGallery from './VenueImageGallery';
import { prettifyCase } from '@/lib/utils';
import VenueRefreshButton from '@/app/components/VenueRefreshButton';
import { FollowEntityButton } from '@/app/components/SaveEventButton';
import { openInMaps } from '@/lib/utils_supabase';
import OpenInMapsButton from '@/app/components/OpenInMapsButton';
import { geocodeAddress } from '@/lib/geocoding';
import VenueDetailsEditor from './VenueDetailsEditor';
import { renderDescriptionWithLineBreaks } from '@/app/components/Components';


export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = await params;

    const [venues, allEvents] = await Promise.all([
        getCachedVenues(),
        getCachedEvents(false, venueId),
    ]);

    const [uniqueVenueAttributes, aggregatedVenueAttributes, venueAttributes] = await Promise.all([
        getUniqueVenueAttributes(venueId),
        getAggregatedVenueAttributes(venueId),
        getVenueAttributes(venueId),
    ]);

    const venueComments = await getVenueComments(venueId);

    const ratedComments = (venueComments ?? []).filter((comment: any) => Number(comment.rating) > 0);
    const ratingCount = ratedComments.length;
    const averageRating = ratingCount > 0
        ? ratedComments.reduce((sum: number, comment: any) => sum + Number(comment.rating), 0) / ratingCount
        : 0;
    const textComments = (venueComments ?? [])
        .filter((comment: any) => Boolean(comment.comment?.trim()))
        .sort((first: any, second: any) => Date.parse(second.created_at) - Date.parse(first.created_at))
        .slice(0, 5);

    const venue = venues.find(v => v.id === venueId);
    if (!venue) return notFound();

    const venueCoordinates = venue.address ? await geocodeAddress(venue.address) : null;

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
            {<VenueImageGallery photourls={venue.photourls} venueName={venue.name} />}

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            <div className="flex flex-col gap-4 mb-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h2 className="text-sm text-text uppercase">{venue.type}</h2>
                                    <h1 className="text-4xl text-text font-bold mt-2">{venue.name}</h1>
                                </div>
                                <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
                                    <FollowEntityButton entity="venues" entityId={venue.id} />
                                </div>
                            </div>
                        </section>
                        <div className="mb-4">
                            <VenueDetailsEditor venue={venue} attributes={venueAttributes} />
                        </div>
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
                            <p className="text-text">{renderDescriptionWithLineBreaks(venue.bio)}</p>
                        </section>}



                        {/* Address & Map */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            <OpenInMapsButton address={venue.address} />
                            {venueCoordinates ? (
                                <iframe
                                    width="100%"
                                    height="300"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${venueCoordinates.lng - 0.005}%2C${venueCoordinates.lat - 0.005}%2C${venueCoordinates.lng + 0.005}%2C${venueCoordinates.lat + 0.005}&layer=mapnik&marker=${venueCoordinates.lat}%2C${venueCoordinates.lng}`}
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
                                <h2 className="font-semibold text-text text-lg mb-4">Reviews &amp; Comments</h2>
                                <div className="mb-5 rounded-lg border border-default p-4">
                                    <p className="text-sm text-muted mb-2">Aggregate Rating</p>
                                    {ratingCount > 0 ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star key={star} size={18} className={star <= Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                                ))}
                                            </div>
                                            <p className="text-sm text-text">{averageRating.toFixed(1)} out of 5 ({ratingCount} rating{ratingCount === 1 ? '' : 's'})</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted">No ratings yet.</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {textComments.length > 0 ? textComments.map((comment: any, index: number) => (
                                        <blockquote key={`${comment.event_id}-${comment.created_at}-${index}`} className="rounded-lg border border-default p-4">
                                            <p className="text-sm text-text">&ldquo;{comment.comment}&rdquo;</p>
                                            <footer className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                                                <span>{comment.username}</span>
                                                <span aria-hidden="true">&middot;</span>
                                                <Link href={`/events/${comment.event_id}`} className="font-semibold text-accent hover:underline">
                                                    {comment.eventName}
                                                </Link>
                                            </footer>
                                        </blockquote>
                                    )) : <p className="text-sm text-muted">No written comments yet.</p>}
                                </div>
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