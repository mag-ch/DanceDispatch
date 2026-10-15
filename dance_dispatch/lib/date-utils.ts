type EventDateFields = {
    startdate: string;
    starttime?: string | null;
    enddate?: string | null;
    endtime?: string | null;
};

export function isUpcoming(event: EventDateFields, now: Date = new Date()): boolean {
    const endDate = event.enddate || event.startdate;
    const endTime = event.endtime || event.starttime || '23:59:59';
    const eventEnd = new Date(`${endDate.split('T')[0]}T${endTime}`);
    return eventEnd >= now;
}

const parseDateOnlyAsLocal = (dateStr: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return new Date(dateStr);

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
};

export const formatDateOnly = (dateStr: string, timeStr?: string) => {
    const date = parseDateOnlyAsLocal(dateStr);
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        date.setHours(hours, minutes);
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        //year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
};
