import type { Company } from "@/entities/company/model/types";

/** Компании в формате openapi.yaml: synthetic_u — синтетический код, cl_type на backend всегда CLIENT */
const COMPANIES: Company[] = [
  { id: 1, synthetic_u: 'U_10137', org_type: 'ООО', mainokved_code: '46.90', mainokved_name: 'Оптовая торговля', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 184_500_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Санкт-Петербург', region: 'Северо-Западный' },
  { id: 2, synthetic_u: 'U_10274', org_type: 'ООО', mainokved_code: '62.01', mainokved_name: 'IT и разработка ПО', company_age_years_gradation: '3-5 лет', amount_workers_fns_gradation: '16-100', revenue_company: 96_200_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Москва', region: 'Центральный' },
  { id: 3, synthetic_u: 'U_10411', org_type: 'ИП', mainokved_code: '56.10', mainokved_name: 'Общественное питание', company_age_years_gradation: '1-3 года', amount_workers_fns_gradation: '1-15', revenue_company: 12_700_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Казань', region: 'Приволжский' },
  { id: 4, synthetic_u: 'U_10548', org_type: 'АО', mainokved_code: '41.20', mainokved_name: 'Строительство', company_age_years_gradation: 'Более 10 лет', amount_workers_fns_gradation: '101-250', revenue_company: 1_240_000_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Екатеринбург', region: 'Уральский' },
  { id: 5, synthetic_u: 'U_10685', org_type: 'ООО', mainokved_code: '01.11', mainokved_name: 'Сельское хозяйство', company_age_years_gradation: 'Более 10 лет', amount_workers_fns_gradation: '101-250', revenue_company: 640_000_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Краснодар', region: 'Южный' },
  { id: 6, synthetic_u: 'U_10822', org_type: 'ООО', mainokved_code: '49.41', mainokved_name: 'Грузоперевозки', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 210_300_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Новосибирск', region: 'Сибирский' },
  { id: 7, synthetic_u: 'U_10959', org_type: 'ИП', mainokved_code: '47.91', mainokved_name: 'Розничная торговля', company_age_years_gradation: '1-3 года', amount_workers_fns_gradation: '1-15', revenue_company: 8_400_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Нижний Новгород', region: 'Приволжский' },
  { id: 8, synthetic_u: 'U_11096', org_type: 'ООО', mainokved_code: '86.21', mainokved_name: 'Медицина', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 158_000_000, cl_type: 'CLIENT', okfs_name: 'Частная собственность', eco_mark_label: null, city: 'Ростов-на-Дону', region: 'Южный' },
];

/** Какие компании (по id) привязаны к демопользователям */
const DEMO_USER_COMPANIES: Record<number, number[]> = {
  1: [1, 2, 6],
  2: [3, 7],
  3: [4, 5, 8],
};

export { COMPANIES, DEMO_USER_COMPANIES };
