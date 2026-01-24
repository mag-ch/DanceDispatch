'use server';

import path from 'path';
import  {parse}  from 'csv-parse/sync';
import { promises as fs } from "fs";
import { hostname } from 'os';

export interface Event {
    id: string;
    title: string;
    startdate: string;
    starttime: string;
    enddate: string;
    endtime: string;
    locationid: string;
    location: string;
    description: string;
    price: number;
    imageurl?: string;
    externallink?: string;
    hosts?: string[]; 
    // Add other fields as needed based on your CSV structure
}
export interface Venue {
    id: string;
    name: string;
    address: string;
    type: string;
    bio: string;
    tags: string;
    residents: string;
    photourls: string;
    // Add other fields as needed based on your CSV structure
}
export interface Host {
    id: string;
    name: string;
    bio: string;
    photoUrl: string;
    tags: string;
    // Add other fields as needed based on your CSV structure
}



export interface EventReview {
    eventId: string;
    username:string;
    dateSubmitted: string;
    mainComment?: string;
    venueReview?: {
        rating: number;
        comments: string;
    };
    djReviews?: {
        djId: string;
        rating: number;
        comments: string;
    }[];
    privacyLevel: 'public' | 'private' | 'anonymous';

}



let eventsCache: Event[] | null = null;
let eventsCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getEvents(includeUpcoming = true, venueId?: string|number, hostId?: string|number, forceRefresh = false): Promise<Event[]> {
    const now = Date.now();
    
    // Return cached data if available, not expired, and no filters applied
    if (!forceRefresh && eventsCache && !venueId && !hostId && (now - eventsCacheTimestamp < CACHE_DURATION)) {
        return includeUpcoming ? eventsCache : eventsCache.filter(event => {
            const eventDate = new Date(`${event.startdate} ${event.starttime}`);
            return eventDate >= new Date();
        });
    }
    
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'events.csv');
    
    try {
        var res: Event[] = [];
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        const now = new Date();
       
        await Promise.all(records.map(async (record: any) => {
            // Parse hosts from string format to array of strings
            let hostIds: string[] = [];
            let hostNames: string[] = [];
            if (record.Hosts) {
                const hostsStr = record.Hosts.toString().trim();
                // Check if it's in bracket format like "[]" or "[1,2,3]"
                if (hostsStr.startsWith('[') && hostsStr.endsWith(']')) {
                    const content = hostsStr.slice(1, -1).trim();
                    if (content) {
                        // Extract numbers from formats like "np.int64(5)" or plain "5"
                        hostIds = content.split(',').map((id: string) => {
                            const cleaned = id.trim();
                            // Match number inside int64() or np.int64() or plain number
                            const match = cleaned.match(/(?:np\.)?int64\((\d+)\)|(\d+)/);
                            return match ? (match[1] || match[2]) : '';
                        }).filter((id: string) => id !== '');
                    }
                } else if (hostsStr) {
                    // Plain comma-separated format
                    hostIds = hostsStr.split(',').map((id: string) => id.trim()).filter((id: string) => id !== '');
                }
                // Use Promise.all to properly await all host name lookups
                hostNames = await Promise.all(
                    hostIds.map(async (id) => {
                        const hostName = await getHost(id);
                        return hostName;
                    })
                );
            }

            var event: Event = {
                id: record.ID.toString(),
                title: record.Title,
                startdate: record.StartDate,
                starttime: record.StartTime,
                enddate: record.EndDate,
                endtime: record.EndTime,
                locationid: record.Location.toString(),
                location: await getLocation(record.Location),
                description: record.Description,
                price: parseFloat(record.Price),
                imageurl: record.PhotoURL,
                externallink: record.ExternalURLs,
                hosts: hostNames,
            };
            
            
            // if venueId is provided, filter by venueId
            if (venueId && Number(record.Location) != Number(venueId)) {
                return;
            }
            
            // if hostId is provided, filter by hostId
            if (hostId && record.Hosts) {
                const hostIds = record.Hosts.split(',').map((id: string) => id.trim());
                if (!hostIds.includes(hostId.toString())) {
                    return;
                }
            }

            // Only add upcoming events if includeUpcoming is true
            const eventDate = new Date(`${event.startdate} ${event.starttime}`);
            if (!includeUpcoming || eventDate >= now) {
                res.push(event);
            }
        }));
        // Sort by date ascending
        res.sort((a, b) => {
            const dateA = new Date(`${a.startdate} ${a.starttime}`);
            const dateB = new Date(`${b.startdate} ${b.starttime}`);
            return dateA.getTime() - dateB.getTime();
        });
        
        // Cache if no filters applied
        if (!venueId && !hostId) {
            eventsCache = res;
            eventsCacheTimestamp = Date.now();
        }
        
        return res;
    } catch (error) {
        console.error('Error reading events CSV:', error);
        return [];
    }
}

async function getHost(hostId: string): Promise<string> {
    if (!hostId) return '';
    if (parseFloat(hostId).toString() !== '') {
        // get location from venues.csv by ID
        const filePath = path.join(process.cwd(), 'data', 'csv_files', 'hosts.csv');
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
            
             for (const record of records as any[]) {
                if (record.ID == hostId) {
                    return record.Name;
                }
            }
            
        } catch (error) {
            console.error('Error reading hosts CSV:', error);
        } 
    }
    if (typeof hostId === 'string') return hostId;
    return "Unknown Host";
}


export async function getEventById(eventId: string): Promise<Event | null> {
    // Try to use cache first
    const events = await getEvents(false);
    return events.find(e => e.id === eventId) || null;
}

export async function userSaveEvent(eventId: string, userId: string, saveBool: boolean): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_events.csv');
    const recordId = `${userId}-${eventId}`;
    
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        // Use Map for O(1) lookup
        const recordMap = new Map<string, any>();
        records.forEach((record: any) => {
            recordMap.set(record.ID, record);
        });
        
        // Update or add the record
        if (recordMap.has(recordId)) {
            recordMap.get(recordId)!.Saved = saveBool.toString();
        } else {
            recordMap.set(recordId, {
                ID: recordId,
                UserID: userId,
                EventID: eventId,
                Saved: saveBool.toString()
            });
        }
        
        // Build file content once
        let newFileContent = 'ID,UserID,EventID,Saved\n';
        recordMap.forEach((record) => {
            newFileContent += `${record.ID},${record.UserID},${record.EventID},${record.Saved}\n`;
        });
        
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        return recordId;
    } catch (error) {
        console.error('Error updating user saved events CSV:', error);
        throw error;
    }  
}


export async function userSaveVenue(venueId: string, userId: string, saveBool: boolean): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_venues.csv');
    const recordId = `${userId}-${venueId}`;
    
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        // Use Map for O(1) lookup
        const recordMap = new Map<string, any>();
        records.forEach((record: any) => {
            recordMap.set(record.ID, record);
        });
        
        // Update or add the record
        if (recordMap.has(recordId)) {
            recordMap.get(recordId)!.Saved = saveBool.toString();
        } else {
            recordMap.set(recordId, {
                ID: recordId,
                UserID: userId,
                VenueID: venueId,
                Saved: saveBool.toString()
            });
        }
        
        // Build file content once
        let newFileContent = 'ID,UserID,VenueID,Saved\n';
        recordMap.forEach((record) => {
            newFileContent += `${record.ID},${record.UserID},${record.VenueID},${record.Saved}\n`;
        });
        
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        return recordId;
    } catch (error) {
        console.error('Error updating user saved events CSV:', error);
        throw error;
    }  
}


export async function userSaveHost(hostId: string, userId: string, saveBool: boolean): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_hosts.csv');
    const recordId = `${userId}-${hostId}`;
    
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        // Use Map for O(1) lookup
        const recordMap = new Map<string, any>();
        records.forEach((record: any) => {
            recordMap.set(record.ID, record);
        });
        
        // Update or add the record
        if (recordMap.has(recordId)) {
            recordMap.get(recordId)!.Saved = saveBool.toString();
        } else {
            recordMap.set(recordId, {
                ID: recordId,
                UserID: userId,
                HostID: hostId,
                Saved: saveBool.toString()
            });
        }
        
        // Build file content once
        let newFileContent = 'ID,UserID,HostID,Saved\n';
        recordMap.forEach((record) => {
            newFileContent += `${record.ID},${record.UserID},${record.HostID},${record.Saved}\n`;
        });
        
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        return recordId;
    } catch (error) {
        console.error('Error updating user saved events CSV:', error);
        throw error;
    }  
}

export async function userSubmitReview(reviewData: any, userId: string, eventId:string): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'reviews.csv');
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const timestamp = new Date().toISOString().split('.')[0] + 'Z';
        let newFileContent = fileContent.trim() + `\n${userId},${eventId},${reviewData.entityType},${reviewData.entityId},${reviewData.rating},"${reviewData.comment}",${reviewData.privacyLevel},${timestamp}\n`;
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        return 'success';
    } catch (error) {
        console.error('Error writing to reviews CSV:', error);
        throw error;
    }   
}

export async function updateEvent(eventId: string, updatedFields: Partial<Event>): Promise<string | null> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'events.csv');
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        let eventFound = false;
        let newFileContent = 'ID,Title,StartDate,StartTime,EndDate,EndTime,Location,Description,Price,PhotoURL,ExternalURLs,Hosts\n';
        console.log('Updating event with ID:', updatedFields);
        records.forEach((record: any) => {
            if (record.ID === eventId) {
                eventFound = true;  
                // Update fields

                // for (const key in record){
                //     if (key in updatedFields) {
                //         const recordKey = key.charAt(0).toUpperCase() + key.slice(1);
                //         (record as any)[recordKey] = (updatedFields as any)[key].includes(',') ? `"${(updatedFields as any)[key]}"` : (updatedFields as any)[key];
                //     }
                //     else {
                //         (record as any)[key] = (record as any)[key].includes(',') ? `"${(record as any)[key]}"` : (record as any)[key];
                //     }

                // }

                for (const key in updatedFields) {
                    const recordKey = key.charAt(0).toUpperCase() + key.slice(1);   
                    if (recordKey in record) {
                        (record as any)[recordKey] = (updatedFields as any)[key];
                    }
                }
            }
            newFileContent += `${record.ID},"${record.Title}",${record.StartDate},${record.StartTime},${record.EndDate},${record.EndTime},${record.Location},"${record.Description}",${record.Price},"${record.PhotoURL}","${record.ExternalURLs}","${record.Hosts}"\n`;
        });
        if (!eventFound) {
            return null;    
        }   
        console.log('Updated event CSV content:\n', newFileContent);
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        // Invalidate cache
        eventsCache = null;
        eventsCacheTimestamp = 0;
        return eventId;
    } catch (error) {
        console.error('Error updating event in CSV:', error);
        return null;
    }   
}

export async function processUrl(url: string): Promise<string> {
    // strip [ and ] and " and ' from url if present
    url = url.replace(/[\[\]"']/g, '');
    return url;
}

export async function checkHostSaved(host: Host): Promise<boolean> {
    return false;
}   
export async function checkVenueSaved(venue: Venue): Promise<boolean> {
    return false;
}   

export async function checkEventSaved(event: Event, userId: string | null): Promise<boolean> {
    if (!userId) return false;
    
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_events.csv');
    const targetId = `${userId}-${event.id}`;

    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        // Direct lookup - exits early when found
        for (const record of records as any[]) {
            if (record.ID === targetId) {
                return record.Saved === 'true';
            }
        }
    } catch (error) {
        console.error('Error reading user saved events CSV:', error);
    }   
    return false;
}


async function getLocation(locationField: any): Promise<string> {
    if (!locationField) return '';
    if (parseFloat(locationField).toString() !== 'NaN') {
        locationField = parseFloat(locationField);
        // get location from venues.csv by ID
        const filePath = path.join(process.cwd(), 'data', 'csv_files', 'venues.csv');
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
            
             for (const record of records as any[]) {
                if (record.ID == locationField) {
                    return record.Name;
                }
            }
            
        } catch (error) {
            console.error('Error reading events CSV:', error);
        } 
    }
    if (typeof locationField === 'string') return locationField;
    return "Unknown Location";
}

let venuesCache: Venue[] | null = null;

export async function getVenues(forceRefresh = false): Promise<Venue[]> {
    if (venuesCache && !forceRefresh) {
        return venuesCache;
    }

    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'venues.csv');
    
    try {
        var res: Venue[] = [];
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        records.forEach((record: any) => {
            var venue: Venue = {
                id: record.ID,
                name: record.Name,
                address: record.Address,
                type: record.Type,
                bio: record.Bio,
                tags: record.Tags,
                residents: record.Residents,
                photourls: record.PhotoURLs,
            };
            res.push(venue);
        });
        venuesCache = res;
        return venuesCache;
    } catch (error) {
        console.error('Error reading venues CSV:', error);
        return [];
    }
}

export async function getHosts(): Promise<Host[]> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'hosts.csv');
    
    try {
        var res: Host[] = [];

        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        records.forEach((record: any) => {
            var host: Host = {
                id: record.ID,
                name: record.Name,
                bio: record.Bio,
                photoUrl: record.PhotoURL,
                tags: record.Tags,
            };
            res.push(host);
        });
        return res;
    } catch (error) {
        console.error('Error reading events CSV:', error);
        return [];
    }
}

export async function getTags(): Promise<Event[]> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'tags.csv');
    
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        return records as Event[];
    } catch (error) {
        console.error('Error reading events CSV:', error);
        return [];
    }
}
export async function getUniqueBoroughs(): Promise<string[]> {
    const venues = await getVenues();
    const boroughs = new Set<string>();
    
    venues.forEach((venue) => {
        const parts = venue.address.split(',');
        if (parts.length >= 2) {
            const borough = parts[1].trim();
            boroughs.add(borough);
        }
    });
    
    return Array.from(boroughs).sort();
}

export async function getRelatedEvents(currentEvent: Event, numResults: number): Promise<Event[]> {
    // For simplicity, related events are those that share the same locationid
    let currNumResults = 0;
    const relatedEvents: Event[] = [];
    const events = await getEvents();
    //event.hosts?.some(element => currentEvent.hosts?.includes(element))
    events
        .filter((event) => event.id !== currentEvent.id)
        .sort((a, b) => {
            const dateA = new Date(`${a.startdate} ${a.starttime}`);
            const dateB = new Date(`${b.startdate} ${b.starttime}`);
            return dateA.getTime() - dateB.getTime();
        })
        .slice(0, numResults)
        .forEach((event) => {
            relatedEvents.push(event);
        });
    return relatedEvents;
}


export async function getEventReviews(eventId: string): Promise<EventReview[]> {
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'reviews.csv');
    try {
        var res: EventReview[] = [];
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as any[];
        const eventRecords = records.filter((record: any) => record.EventID === eventId);
        // Group reviews by UserID and Timestamp
        const groupedReviews = new Map<string, any[]>();
        eventRecords.forEach((record: any) => {
            const key = `${record.UserID}-${record.SubmitDate || new Date().toISOString()}`;
            if (!groupedReviews.has(key)) {
                groupedReviews.set(key, []);
            }
            groupedReviews.get(key)!.push(record);
        });
        console.log('Event Records:', groupedReviews);
        
        // console.log('Grouped Reviews:', groupedReviews);
        // Create EventReview for each group
        groupedReviews.forEach((records, key) => {
            const mainComment = records.find((record: any) => record.EntityType === 'event')?.Comment;
            const venueReviewRecord = records.find((record: any) => record.EntityType === 'venue');
            const venueReview = venueReviewRecord ? {
                rating: parseInt(venueReviewRecord.Rating),
                comments: venueReviewRecord.Comment
            } : undefined;
            const djReviews = records.filter((record: any) => record.EntityType === 'dj').map((record: any) => ({
                djId: record.EntityID,
                rating: parseInt(record.Rating),
                comments: record.Comment
            }));
            
            const eventReview: EventReview = {
                eventId: eventId,
                username: records[0]?.UserID || 'Anonymous',
                dateSubmitted: records[0]?.SubmitDate || new Date().toISOString(),
                mainComment: mainComment,
                venueReview: venueReview,
                djReviews: djReviews,
                privacyLevel: records[0]?.PrivacyLevel || 'public'
            };
            res.push(eventReview);
        });
        
        return res;
    }
    catch (error) {
        console.error('Error reading reviews CSV:', error);
        return [];
    }   
}