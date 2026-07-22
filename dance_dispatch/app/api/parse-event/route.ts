import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import type { Event } from "@/lib/utils";

export async function POST(request: NextRequest) {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status}` },
                { status: 502 }
            );
        }

        const html = await response.text();

        console.log(`Fetched HTML for ${url}: ${html.length} characters`);
        const $ = cheerio.load(html);

        const result: Event = {
            id: "",
            title: "",
            description: "",
            imageurl: "",
            startdate: "",
            enddate: "",
            starttime: "",
            endtime: "",
            location: "",
            locationid: "",
            price: undefined,
            externallink: response.url,
        };

        // Open Graph
        const getOg = (property: string): string | null =>
            $(`meta[property="og:${property}"]`).attr('content')?.trim() || null;

        result.title = getOg('title') ?? "";
        result.description = getOg('description') ?? "";
        result.imageurl = getOg('image') ?? "";

        // Meta fallbacks
        if (!result.title) result.title = $('title').text().trim() || "";
        if (!result.description) {
            result.description = $('meta[name="description"]').attr('content')?.trim() || "";
        }

        // Schema.org JSON-LD
        const jsonLdScripts = $('script[type="application/ld+json"]');
        let schemaEvent: Record<string, unknown> | null = null;

        for (let i = 0; i < jsonLdScripts.length; i++) {
            try {
                const raw = jsonLdScripts.eq(i).html();
                if (!raw) continue;
                const data = JSON.parse(raw.trim());
                const items = Array.isArray(data['@graph']) ? data['@graph'] : [data];

                for (const item of items) {
                    const type = item['@type'];
                    const types = Array.isArray(type) ? type : [type];
                    if (types.some((t) => t === 'Event')) {
                        schemaEvent = item;
                        break;
                    }
                }
                if (schemaEvent) break;
            } catch {
                // ignore malformed JSON
            }
        }

        if (schemaEvent) {
            result.title = (schemaEvent.name as string) || result.title;
            result.description = (schemaEvent.description as string) || result.description;
            result.imageurl = extractImageFromSchema(schemaEvent) || result.imageurl;
            result.externallink = (schemaEvent.url as string) || result.externallink;

            const start = schemaEvent.startDate as string;
            const end = schemaEvent.endDate as string;

            if (start) {
                const { date, time } = splitDateTime(start);
                result.startdate = date;
                result.starttime = time ?? "";
            }
            if (end) {
                const { date, time } = splitDateTime(end);
                result.enddate = date;
                result.endtime = time ?? "";
            }

            const loc = schemaEvent.location as Record<string, unknown> | undefined;
            if (loc) {
                result.location =  loc.name as string || "";
            }

            const offers = schemaEvent.offers as Record<string, unknown> | undefined;
            if (offers) {
                const price = offers.price as string | number | undefined;
                const priceCurrency = offers.priceCurrency as string | undefined;
                if (price !== undefined) {
                    result.price = Number(price);
                }
            }
        }

        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

function splitDateTime(isoString: string): { date: string; time: string | null } {
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) {
            const [datePart, timePart] = isoString.split('T');
            return { date: datePart || isoString, time: timePart ? timePart.slice(0, 5) : null };
        }
        return { date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0, 5) };
    } catch {
        return { date: isoString, time: null };
    }
}

function extractImageFromSchema(schema: Record<string, unknown>): string | null {
    const image = schema.image;
    if (typeof image === 'string') return image;
    if (Array.isArray(image) && image.length > 0) {
        const first = image[0];
        return typeof first === 'string' ? first : (first?.url as string) || null;
    }
    if (image && typeof image === 'object') {
        return (image as Record<string, unknown>).url as string | null;
    }
    return null;
}

function extractAddress(loc: Record<string, unknown>): string | null {
    const addr = loc.address as Record<string, unknown> | string | undefined;
    if (typeof addr === 'string') return addr;
    if (addr) {
        const parts = [
            addr.streetAddress,
            addr.addressLocality,
            addr.addressRegion,
            addr.postalCode,
            addr.addressCountry,
        ]
            .filter(Boolean)
            .join(', ');
        return parts || null;
    }
    return null;
}