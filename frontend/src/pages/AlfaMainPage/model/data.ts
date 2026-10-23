import type { ComponentType, SVGProps } from "react";
import {
  CardIcon, CertificateIcon, ClockIcon, FeedIcon, FileDownloadIcon, FileIcon, FilePlusIcon,
  FileSearchIcon, InvoiceIcon, ListIcon, PlusIcon, RequestsIcon, UsersIcon,
} from "../ui/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface MenuItem {
  label: string;
  icon: Icon;
  badge?: string;
}

const MENU: MenuItem[] = [
  { label: 'Заявки', icon: RequestsIcon, badge: 'Новое' },
  { label: 'Новый платёж', icon: PlusIcon },
  { label: 'Лента операций', icon: FeedIcon },
  { label: 'Платежи в работе', icon: ClockIcon },
  { label: 'Импорт реестров', icon: FileIcon },
  { label: 'Выписка', icon: FileSearchIcon },
  { label: 'Счета', icon: ListIcon },
  { label: 'Контрагенты', icon: UsersIcon },
  { label: 'Справки', icon: CertificateIcon },
  { label: 'Счета на оплату', icon: InvoiceIcon },
  { label: 'Карты', icon: CardIcon },
];

const QUICK_ACTIONS: Array<{ label: string, icon: Icon }> = [
  { label: 'Скачать выписку', icon: FileDownloadIcon },
  { label: 'Импорт платежей', icon: FileIcon },
  { label: 'Создать платёж', icon: FilePlusIcon },
];

const ACCOUNT = {
  balance: '2 524 550 000,00 RUB',
  overdraft: '10 800 570 344,95 RUB с овердрафтом',
  currencies: ['4 000,00 CNY', '40 000,00 KZT'],
  moreCurrencies: 5,
};

type TaskTone = 'accent' | 'neutral' | 'muted';

const TASKS: Array<{ label: string, count: number, tone: TaskTone }> = [
  { label: 'Подписать и отправить', count: 1, tone: 'accent' },
  { label: 'В работе у банка', count: 7, tone: 'accent' },
  { label: 'Отклонённые', count: 4, tone: 'accent' },
  { label: 'Черновики', count: 1, tone: 'neutral' },
  { label: 'Оплатить', count: 1, tone: 'neutral' },
  { label: 'Доработать', count: 0, tone: 'muted' },
  { label: 'Принять предложение', count: 3, tone: 'neutral' },
];

const SUMMARY_TABS = ['Сводка', 'Счета на главной', 'Мультибанк', 'Металлы'];

const REQUESTS = [
  { product: 'Лизинг', amount: '75 000 ₽', date: '09.04.2026', status: 'На подпись', step: 2, steps: 5 },
  { product: 'Факторинг', amount: '1 200 000 ₽', date: '02.04.2026', status: 'В работе', step: 3, steps: 4 },
];

export { MENU, QUICK_ACTIONS, ACCOUNT, TASKS, SUMMARY_TABS, REQUESTS, type TaskTone };
