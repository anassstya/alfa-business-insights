CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,
    synthetic_u TEXT NOT NULL,
    org_type TEXT,
    okfs_name TEXT,
    company_age_years_gradation TEXT,
    eco_mark_label TEXT,
    mainokved_code TEXT,
    mainokved_name TEXT,
    negativemark NUMERIC,
    amount_workers_fns_gradation TEXT,
    amount_workers_spark_gradation TEXT,
    cl_type TEXT,
    cl_product_rko_mark NUMERIC,
    cl_product_gar_mark NUMERIC,
    cl_product_loa_mark NUMERIC,
    cl_product_lea_mark NUMERIC,
    cl_product_dep_mark NUMERIC,
    cl_product_zpp_mark NUMERIC,
    fts_flag NUMERIC,
    fts_country_name TEXT,
    factoring_mark NUMERIC,
    revenue_company NUMERIC,
    group_id TEXT,
    city TEXT,
    region TEXT
);

CREATE TABLE IF NOT EXISTS person_company_links (
    id BIGSERIAL PRIMARY KEY,
    synthetic_f TEXT NOT NULL,
    city_name TEXT,
    rc_name TEXT,
    synthetic_u TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    beneficiary TEXT NOT NULL,
    payer TEXT NOT NULL,
    pay_amt NUMERIC,
    pay_cnt BIGINT
);

CREATE INDEX IF NOT EXISTS idx_companies_synthetic_u
    ON companies (synthetic_u);

CREATE INDEX IF NOT EXISTS idx_person_company_links_person
    ON person_company_links (synthetic_f);

CREATE INDEX IF NOT EXISTS idx_person_company_links_company
    ON person_company_links (synthetic_u);

CREATE INDEX IF NOT EXISTS idx_payments_payer
    ON payments (payer);

CREATE INDEX IF NOT EXISTS idx_payments_beneficiary
    ON payments (beneficiary);
