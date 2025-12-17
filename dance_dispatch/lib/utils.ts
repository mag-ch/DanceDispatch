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
    location: string;
    description: string;
    price: number;
    // Add other fields as needed based on your CSV structure
}
export interface Venue {
    id: string;
    name: string;
    address: string;
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

export async function getEvents(): Promise<Event[]> {
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
        
        records.forEach((record: any) => {
            var event: Event = {
                id: record.ID,
                title: record.Title,
                startdate: record.StartDate,
                starttime: record.StartTime,
                enddate: record.EndDate,
                endtime: record.EndTime,
                location: record.Location,
                description: record.Description,
                price: parseFloat(record.Price),
            };
            
            // Only add upcoming events
            const eventDate = new Date(`${event.startdate} ${event.starttime}`);
            if (eventDate >= now) {
                res.push(event);
            }
        });
        
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