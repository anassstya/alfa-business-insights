import { addDays, toIsoDate } from "@/shared";

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

interface DateFilterValue {
  preset: DatePreset;
  from: string;
  to: string;
}

const DATE_PRESETS: Array<{ value: DatePreset, label: string }> = [
  { value: 'all', label: 'Всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: '7 дней' },
  { value: 'month', label: '30 дней' },
  { value: 'custom', label: 'Свой период' },
];

const DEFAULT_DATE_FILTER: DateFilterValue = { preset: 'all', from: '', to: '' };

const toNewsFilters = ({ preset, from, to }: DateFilterValue, now = new Date()) => {
  const today = toIsoDate(now);

  switch (preset) {
    case 'today':
      return { date_from: today, date_to: today };
    case 'week':
      return { date_from: toIsoDate(addDays(now, -6)), date_to: today };
    case 'month':
      return { date_from: toIsoDate(addDays(now, -29)), date_to: today };
    case 'custom':
      return { date_from: from || undefined, date_to: to || undefined };
    default:
      return {};
  }
}

const isDateFilterActive = (value: DateFilterValue) => value.preset !== 'all';

export { DATE_PRESETS, DEFAULT_DATE_FILTER, toNewsFilters, isDateFilterActive, type DatePreset, type DateFilterValue };
