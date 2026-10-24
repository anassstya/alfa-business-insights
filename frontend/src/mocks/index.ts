import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { AxiosInstance } from "axios";
import { COMPANIES, DEMO_USER_COMPANIES } from "./companies";
import { buildNews } from "./news";
import { DEMO_USERS, ROLES } from "./users";

const LATENCY_MS = 400;

const respond = <T,>(config: InternalAxiosRequestConfig, data: T, status = 200): Promise<AxiosResponse<T>> => {
  const response: AxiosResponse<T> = { data, status, statusText: status === 200 ? 'OK' : 'Error', headers: {}, config };

  return new Promise((resolve, reject) => setTimeout(() => {
    if (status >= 400) {
      reject(new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response));
      return;
    }
    resolve(response);
  }, LATENCY_MS));
}

const slice = <T,>(items: T[], limit: number, offset: number) => items.slice(offset, offset + limit);

/**
 * Эмулирует backend по контракту backend/api/openapi.yaml
 * (+ предварительный /api/v1/news, которого в спецификации нет).
 */
const mockAdapter: AxiosAdapter = (config) => {
  const url = config.url ?? '';
  const params = (config.params ?? {}) as Record<string, string | number | undefined>;

  if (url === '/api/v1/roles') {
    return respond(config, { roles: ROLES });
  }

  if (url === '/api/v1/demo/users') {
    return respond(config, { users: DEMO_USERS });
  }

  const userCompaniesMatch = url.match(/^\/api\/v1\/demo\/users\/([^/]+)\/companies$/);
  if (userCompaniesMatch) {
    const userId = Number(userCompaniesMatch[1]);

    if (!Number.isInteger(userId) || userId < 1) {
      return respond(config, 'Invalid user ID', 400);
    }
    if (!DEMO_USERS.some(user => user.id === userId)) {
      return respond(config, 'User not found', 404);
    }

    const ids = DEMO_USER_COMPANIES[userId] ?? [];
    return respond(config, { companies: COMPANIES.filter(company => ids.includes(company.id)) });
  }

  if (url === '/api/v1/companies') {
    // как на backend: limit 1..100, offset ≥ 0, иначе 400
    const limit = params.limit === undefined ? 20 : Number(params.limit);
    const offset = params.offset === undefined ? 0 : Number(params.offset);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return respond(config, 'Invalid limit', 400);
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return respond(config, 'Invalid offset', 400);
    }

    return respond(config, { companies: slice(COMPANIES, limit, offset), total: COMPANIES.length, limit, offset });
  }

  if (url === '/api/v1/news') {
    const company = COMPANIES.find(c => c.id === Number(params.company_id));
    const from = params.date_from ? new Date(`${params.date_from}T00:00:00`) : null;
    const to = params.date_to ? new Date(`${params.date_to}T23:59:59.999`) : null;

    const filtered = buildNews()
      .filter(n => n.roles.length === 0 || n.roles.includes(String(params.role)))
      .filter(n => !n.industry || n.industry === company?.mainokved_name)
      .filter(n => {
        const published = new Date(n.published_at);
        return (!from || published >= from) && (!to || published <= to);
      })
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map(({ id, title, summary, source, url, published_at, tags, importance }) => ({ id, title, summary, source, url, published_at, tags, importance }));

    const limit = Number(params.limit ?? 20);
    const offset = Number(params.offset ?? 0);

    return respond(config, { items: slice(filtered, limit, offset), total: filtered.length });
  }

  return respond(config, '404 page not found', 404);
}

const enableMocks = (client: AxiosInstance) => {
  client.defaults.adapter = mockAdapter;
  console.info('[mocks] API замокано (VITE_API_MOCKS=true)');
}

export { enableMocks };
