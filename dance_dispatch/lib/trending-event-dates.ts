export function localDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function startOfWeek(date: Date): Date {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return weekStart;
}

export function groupTrendingEvents<T extends { event: { startdate: string } }>(
  items: T[],
  now: Date
): { today: T[]; tomorrow: T[]; laterThisWeek: T[]; nextWeek: T[]; upcoming: T[] } {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(todayStart.getDate() + 2);
  const weekEnd = startOfWeek(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const nextWeekEnd = new Date(weekEnd);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const isWeekend = todayStart.getDay() === 0 || todayStart.getDay() === 6;

  const groups: { today: T[]; tomorrow: T[]; laterThisWeek: T[]; nextWeek: T[]; upcoming: T[] } = {
    today: [], tomorrow: [], laterThisWeek: [], nextWeek: [], upcoming: [],
  };
  items.forEach((item) => {
    const day = localDay(item.event.startdate).getTime();
    if (day < todayStart.getTime()) return;
    if (day < tomorrowStart.getTime()) groups.today.push(item);
    else if (day < dayAfterTomorrow.getTime()) groups.tomorrow.push(item);
    else if (day < weekEnd.getTime()) groups.laterThisWeek.push(item);
    else if (isWeekend && day < nextWeekEnd.getTime()) groups.nextWeek.push(item);
    else groups.upcoming.push(item);
  });
  return groups;
}
