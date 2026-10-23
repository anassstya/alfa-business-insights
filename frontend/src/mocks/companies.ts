import type { CompanyDetails } from "@/entities/company/model/types";

const COMPANIES: CompanyDetails[] = [
  { id: 1, synthetic_u: 'ООО «Северный ветер»', org_type: 'ООО', industry_code: '46.90', industry_name: 'Оптовая торговля', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 184_500_000, cl_type: 'Средний бизнес', city: 'Санкт-Петербург', region: 'Северо-Западный' },
  { id: 2, synthetic_u: 'ООО «Технопарк Плюс»', org_type: 'ООО', industry_code: '62.01', industry_name: 'IT и разработка ПО', company_age_years_gradation: '3-5 лет', amount_workers_fns_gradation: '16-100', revenue_company: 96_200_000, cl_type: 'Малый бизнес', city: 'Москва', region: 'Центральный' },
  { id: 3, synthetic_u: 'ИП Смирнова А. В.', org_type: 'ИП', industry_code: '56.10', industry_name: 'Общественное питание', company_age_years_gradation: '1-3 года', amount_workers_fns_gradation: '1-15', revenue_company: 12_700_000, cl_type: 'Микробизнес', city: 'Казань', region: 'Приволжский' },
  { id: 4, synthetic_u: 'АО «УралСтройМонтаж»', org_type: 'АО', industry_code: '41.20', industry_name: 'Строительство', company_age_years_gradation: 'Более 10 лет', amount_workers_fns_gradation: '101-250', revenue_company: 1_240_000_000, cl_type: 'Крупный бизнес', city: 'Екатеринбург', region: 'Уральский' },
  { id: 5, synthetic_u: 'ООО «Агрохолдинг Кубань»', org_type: 'ООО', industry_code: '01.11', industry_name: 'Сельское хозяйство', company_age_years_gradation: 'Более 10 лет', amount_workers_fns_gradation: '101-250', revenue_company: 640_000_000, cl_type: 'Средний бизнес', city: 'Краснодар', region: 'Южный' },
  { id: 6, synthetic_u: 'ООО «Логистика 24»', org_type: 'ООО', industry_code: '49.41', industry_name: 'Грузоперевозки', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 210_300_000, cl_type: 'Средний бизнес', city: 'Новосибирск', region: 'Сибирский' },
  { id: 7, synthetic_u: 'ИП Ковалёв Д. С.', org_type: 'ИП', industry_code: '47.91', industry_name: 'Розничная торговля', company_age_years_gradation: '1-3 года', amount_workers_fns_gradation: '1-15', revenue_company: 8_400_000, cl_type: 'Микробизнес', city: 'Нижний Новгород', region: 'Приволжский' },
  { id: 8, synthetic_u: 'ООО «МедЛайн Клиник»', org_type: 'ООО', industry_code: '86.21', industry_name: 'Медицина', company_age_years_gradation: '5-10 лет', amount_workers_fns_gradation: '16-100', revenue_company: 158_000_000, cl_type: 'Малый бизнес', city: 'Ростов-на-Дону', region: 'Южный' },
];

export { COMPANIES };
