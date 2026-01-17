'use server';

import path from 'path';
import  {parse}  from 'csv-parse/sync';
import { promises as fs } from "fs";

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

export async function getEvents(includeUpcoming = true, venueId?: string|number, hostId?: string|number): Promise<Event[]> {
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
                hosts: record.Hosts ? record.Hosts.split(',').map((id: string) => id.trim()) : [],
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
        
        return res;
    } catch (error) {
        console.error('Error reading events CSV:', error);
        return [];
    }
}

export async function userSaveEvent(eventId: string, userId: string, saveBool: boolean): Promise<string> {
    // const isSaved = await checkEventSaved({id: eventId} as Event, userId);
    // if (isSaved) {
        // modify the csv to set saved to saveBool
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_events.csv');
    let isExisting = false;
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        let newFileContent = 'ID,UserID,EventID,Saved\n';
        records.forEach((record: any) => {
            if (record.EventID == eventId && record.UserID == userId) {
                console.log('Found existing record, updating saved status', saveBool);
                record.Saved = saveBool.toString();
                isExisting = true;
            }
            newFileContent += `${record.ID},${record.UserID},${record.EventID},${record.Saved}\n`;
        });
        console.log('isExisting:', isExisting);
        if (!isExisting) {
            const newId = `${userId}-${eventId}`;
            newFileContent += `${newId},${userId},${eventId},${saveBool}\n`;
        }
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        return `${userId}-${eventId}`;
    } catch (error) {
        console.error('Error updating user saved events CSV:', error);
        throw error;
    }  
    // }
    // return new Promise(async (resolve, reject) => {
    //     try {
    //         // Append to user_saved_events.csv
    //         const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_events.csv');
    //         const newId = `${userId}-${eventId}`;
    //         const newLine = `\n${newId},${userId},${eventId},true`;
    //         await fs.appendFile(filePath, newLine, 'utf-8');
    //         resolve(newId);
    //     } catch (error) {
    //         console.error('Error saving user event:', error);
    //         reject(error);
    //     }   
    // });
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

export async function checkEventSaved(event: Event, userId: string): Promise<boolean> {
    // read csv file with list of user ids and saved event ids
    const filePath = path.join(process.cwd(), 'data', 'csv_files', 'user_saved_events.csv');
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        for (const record of records as any[]) {
            if (record.EventID == event.id && record.UserID == userId) {
                return true;
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