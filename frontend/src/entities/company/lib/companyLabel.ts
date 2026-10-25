import type { Company } from "../model/types";

const getCompanyLabel = (company: Company) => company.mainokved_name ?? company.synthetic_u;

const getCompanyDescription = (company: Company) =>
  [company.synthetic_u, company.city].filter(Boolean).join(' · ');

export { getCompanyLabel, getCompanyDescription };
