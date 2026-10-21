const DAY_MS = 1000 * 60 * 60 * 24;

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  return result;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayWithYearFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (date: Date) => timeFormatter.format(date);

const formatDayLabel = (date: Date, now = new Date()) => {
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';

  return date.getFullYear() === now.getFullYear()
    ? dayFormatter.format(date)
    : dayWithYearFormatter.format(date);
}

export { toIsoDate, addDays, startOfDay, formatTime, formatDayLabel };
