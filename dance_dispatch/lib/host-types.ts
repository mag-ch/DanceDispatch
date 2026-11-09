export const HOST_TYPES = ['DJ', 'Promoter', 'Organizer', 'Teacher', 'Host', 'Judge'] as const;
export type HostType = (typeof HOST_TYPES)[number];

// Anything unrecognised (including null) is a plain "host".
export function normalizeHostType(value: unknown): HostType | null {
    const match = HOST_TYPES.find((type) => type.toLowerCase() === String(value ?? '').trim().toLowerCase());
    return match ?? null;
}

export function parseHostGenres(value: string): string[] {
    return value.split(',').map((genre) => genre.trim()).filter(Boolean);
}

function normalizedGenres(value: string | string[] | null | undefined): string[] {
    if (!value) return [];
    const items = Array.isArray(value) ? value : value.split(',');
    return [...new Set(items.map((genre) => genre.replace(/[\[\]{}"']/g, '').trim().toLowerCase()).filter(Boolean))];
}

export function filterHostsByTypeAndGenres<T extends { name: string; host_type: HostType; genres: string[] }>(
    hosts: T[],
    type: HostType | null,
    genres: string
): T[] {
    const filtered = type ? hosts.filter((host) => host.host_type === type) : hosts;
    const requested = normalizedGenres(genres);
    if (requested.length === 0) return filtered;

    return filtered.map((host) => {
        const candidate = normalizedGenres(host.genres);
        const total = requested.reduce((sum, genre) => sum + (
            candidate.includes(genre) ? 1 : candidate.some((other) => other.includes(genre) || genre.includes(other)) ? 0.5 : 0
        ), 0);
        return { host, score: total / Math.max(requested.length, candidate.length) };
    }).filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.host.name.localeCompare(b.host.name))
        .map(({ host }) => host);
}
