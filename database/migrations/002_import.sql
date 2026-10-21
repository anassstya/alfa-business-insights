\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM companies)
       OR EXISTS (SELECT 1 FROM person_company_links)
       OR EXISTS (SELECT 1 FROM payments)
    THEN
        RAISE EXCEPTION 'Database already contains data';
END IF;
END
$$;


COPY companies (
    synthetic_u, org_type, okfs_name,
    company_age_years_gradation, eco_mark_label,
    mainokved_code, mainokved_name, negativemark,
    amount_workers_fns_gradation,
    amount_workers_spark_gradation, cl_type,
    cl_product_rko_mark, cl_product_gar_mark,
    cl_product_loa_mark, cl_product_lea_mark,
    cl_product_dep_mark, cl_product_zpp_mark,
    fts_flag, fts_country_name, factoring_mark,
    revenue_company, group_id, city, region
    )
    FROM '/import/companies.csv'
    WITH (FORMAT csv, HEADER true, DELIMITER ';', ENCODING 'UTF8');

COPY person_company_links (
    synthetic_f, city_name, rc_name, synthetic_u
    )
    FROM '/import/person_company_links.csv'
    WITH (FORMAT csv, HEADER true, DELIMITER ';', ENCODING 'UTF8');

COPY payments (
    beneficiary, payer, pay_amt, pay_cnt
    )
    FROM '/import/payments.csv'
    WITH (FORMAT csv, HEADER true, DELIMITER ';', ENCODING 'UTF8');

COMMIT;
