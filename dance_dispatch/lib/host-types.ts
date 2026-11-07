export const HOST_TYPES = ['DJ', 'Promoter', 'Organizer', 'Teacher'] as const;
export type HostType = (typeof HOST_TYPES)[number];

// Anything unrecognised (including null) is a plain "host".
export function normalizeHostType(value: unknown): HostType | null {
    const match = HOST_TYPES.find((type) => type.toLowerCase() === String(value ?? '').trim().toLowerCase());
    return match ?? null;
}
