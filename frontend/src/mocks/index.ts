import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { AxiosInstance } from "axios";
import { COMPANIES } from "./companies";
import { buildNews } from "./news";

const LATENCY_MS = 400;

const respond = <T,>(config: InternalAxiosRequestConfig, data: T, status = 200): Promise<AxiosResponse<T>> => {
  const response: AxiosResponse<T> = { data, status, statusText: status === 200 ? 'OK' : 'Not Found', headers: {}, config };

  return new Promise((resolve, reject) => setTimeout(() => {
    if (status >= 400) {
      reject(new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response));
      return;
    }
    resolve(response);
  }, LATENCY_MS));
}

const paginate = <T,>(items: T[], params: Record<string, unknown>) => {
  const limit = Number(params.limit ?? 20);
  const offset = Number(params.offset ?? 0);

  return { items: items.slice(offset, offset + limit), total: items.length };
}

const mockAdapter: AxiosAdapter = (config) => {
  const url = config.url ?? '';
  const params = (config.params ?? {}) as Record<string, string | number | undefined>;

  if (url === '/api/v1/companies') {
    const filtered = COMPANIES
      .filter(c => !params.city || c.city === params.city)
      .filter(c => !params.region || c.region === params.region)
      .filter(c => !params.industry || c.industry_name === params.industry)
      .map(({ id, synthetic_u, industry_name, city, region }) => ({ id, synthetic_u, industry_name, city, region }));

    return respond(config, paginate(filtered, params));
  }

  const companyMatch = url.match(/^\/api\/v1\/companies\/(\d+)$/);
  if (companyMatch) {
    const company = COMPANIES.find(c => c.id === Number(companyMatch[1]));

    return company ? respond(config, company) : respond(config, { message: 'Компания не найдена' }, 404);
  }

  if (url === '/api/v1/news') {
    const company = COMPANIES.find(c => c.id === Number(params.company_id));
    const from = params.date_from ? new Date(`${params.date_from}T00:00:00`) : null;
    const to = params.date_to ? new Date(`${params.date_to}T23:59:59.999`) : null;

    const filtered = buildNews()
      .filter(n => n.roles.length === 0 || n.roles.includes(params.role as never))
      .filter(n => !n.industry || n.industry === company?.industry_name)
      .filter(n => {
        const published = new Date(n.published_at);
        return (!from || published >= from) && (!to || published <= to);
      })
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map(({ id, title, summary, source, url, published_at, tags, importance }) => ({ id, title, summary, source, url, published_at, tags, importance }));

    return respond(config, paginate(filtered, params));
  }

  return respond(config, { message: 'Not found' }, 404);
}

const enableMocks = (client: AxiosInstance) => {
  client.defaults.adapter = mockAdapter;
  console.info('[mocks] API замокано (VITE_API_MOCKS=true)');
}

export { enableMocks };
