"""Build database-backed company contexts. Run: python ml/src/base_context.py"""

from __future__ import annotations

import argparse
import json
import math
import os
from bisect import bisect_right
from collections import Counter
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "database/data/company_context.json"
MIN_GROUP_REVENUE = 15_000_000_000
TABLES = {"companies": "companies", "people": "person_company_links", "payments": "payments"}


def get_engine():
    load_dotenv(ROOT / ".env", override=False)
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        from sqlalchemy.engine import make_url
        url = make_url(database_url)
        if url.drivername == "postgresql":
            url = url.set(drivername="postgresql+psycopg")
    else:
        required = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
        missing = [key for key in required if not os.getenv(key)]
        if missing:
            raise RuntimeError("Missing database settings: " + ", ".join(missing) +
                               "; set DATABASE_URL or POSTGRES_* variables")
        url = URL.create("postgresql+psycopg", username=os.environ["POSTGRES_USER"],
                         password=os.environ["POSTGRES_PASSWORD"],
                         host=os.getenv("POSTGRES_HOST", "localhost"),
                         port=int(os.getenv("POSTGRES_PORT", "15432")),
                         database=os.environ["POSTGRES_DB"])
    return create_engine(url, connect_args={"connect_timeout": 5})


def read_table(connection, name):
    """Read one of the fixed, known database tables."""
    return pd.read_sql_query(text(f"SELECT * FROM {TABLES[name]}"), connection)


def select_company_ids(connection, min_group_revenue=MIN_GROUP_REVENUE):
    """Filter clients and placeholders before summing revenue by group."""
    query = text("""
        WITH eligible AS (
            SELECT synthetic_u, group_id, revenue_company FROM companies
            WHERE cl_type = 'CLIENT' AND revenue_company IS DISTINCT FROM 1000
              AND group_id IS NOT NULL
        ), qualified AS (
            SELECT group_id FROM eligible GROUP BY group_id
            HAVING CAST(:threshold AS NUMERIC) IS NULL
                OR SUM(revenue_company) > CAST(:threshold AS NUMERIC)
        )
        SELECT e.synthetic_u FROM eligible e JOIN qualified q USING (group_id)
        ORDER BY e.synthetic_u
    """)
    return pd.read_sql_query(query, connection, params={"threshold": min_group_revenue}).synthetic_u.tolist()


def read_relevant_payments(connection, ids):
    """Fetch all payment edges touching a selected company."""
    if not ids:
        return pd.DataFrame(columns=["payer", "beneficiary", "pay_amt", "pay_cnt"])
    return pd.read_sql_query(text("""SELECT payer, beneficiary, pay_amt, pay_cnt FROM payments
        WHERE payer = ANY(:ids) OR beneficiary = ANY(:ids)"""), connection, params={"ids": ids})


def clean(value):
    if value is None or value is pd.NA or pd.isna(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    return value


def flag(value):
    value = clean(value)
    return None if value is None else bool(value)


def prefix(value):
    value = clean(value)
    return str(value).split(".")[0] if value is not None else None


def category(code):
    # ОКВЭД sections; classification is derived, not a database field.
    sections = ((1, 3, "Сельское, лесное хозяйство, охота, рыболовство и рыбоводство"),
                (5, 9, "Добыча полезных ископаемых"), (10, 33, "Обрабатывающие производства"),
                (35, 35, "Обеспечение электрической энергией, газом и паром"),
                (36, 39, "Водоснабжение, водоотведение и утилизация отходов"),
                (41, 43, "Строительство"), (45, 47, "Торговля оптовая и розничная"),
                (49, 53, "Транспортировка и хранение"),
                (55, 56, "Деятельность гостиниц и предприятий общественного питания"),
                (58, 63, "Деятельность в области информации и связи"),
                (64, 66, "Деятельность финансовая и страховая"),
                (68, 68, "Деятельность по операциям с недвижимым имуществом"),
                (69, 75, "Деятельность профессиональная, научная и техническая"),
                (77, 82, "Деятельность административная и сопутствующие услуги"),
                (84, 84, "Государственное управление"), (85, 85, "Образование"),
                (86, 88, "Деятельность в области здравоохранения и социальных услуг"),
                (90, 93, "Деятельность в области культуры, спорта и развлечений"),
                (94, 96, "Предоставление прочих видов услуг"),
                (97, 98, "Деятельность домашних хозяйств"),
                (99, 99, "Деятельность экстерриториальных организаций и органов"))
    if code is None or not code.isdigit():
        return None
    return next((name for first, last, name in sections if first <= int(code) <= last), None)


def id_sort(value):
    tail = str(value).split("_")[-1]
    return (int(tail), str(value)) if tail.isdigit() else (math.inf, str(value))


class ContextBuilder:
    def __init__(self, companies, people, selected_ids):
        for frame in (companies, people):
            frame.columns = frame.columns.str.lower()
        unique_profiles = companies[~companies.synthetic_u.duplicated(keep=False)]
        self.profiles = unique_profiles.set_index("synthetic_u").to_dict("index")
        companies = companies.copy()
        companies["okved_prefix"] = companies.mainokved_code.map(prefix)
        selected_groups = set(companies.loc[companies.synthetic_u.isin(selected_ids), "group_id"])
        self.groups = dict(tuple(companies[companies.group_id.isin(selected_groups)].groupby("group_id")))
        self.peers = {}
        for code, group in companies.groupby("okved_prefix"):
            values = sorted(group.revenue_company.dropna().astype(float))
            self.peers[code] = (values, sum(values))
        self.people_by_company = dict(tuple(people.groupby("synthetic_u")))
        self.people_by_person = dict(tuple(people.groupby("synthetic_f")))
    def load_payments(self, payments):
        payments.columns = payments.columns.str.lower()
        self.self_payments = payments[payments.payer == payments.beneficiary]
        external = payments[payments.payer != payments.beneficiary]
        external = external.groupby(["payer", "beneficiary"], as_index=False, sort=False).agg(
            pay_amt=("pay_amt", "sum"), pay_cnt=("pay_cnt", "sum"))
        self.incoming = dict(tuple(external.groupby("beneficiary")))
        self.outgoing = dict(tuple(external.groupby("payer")))

    def summary(self, company_id, group_ids):
        row = self.profiles.get(company_id)
        return {"company_id": company_id,
                "okved_code": clean(row["mainokved_code"]) if row else None,
                "okved_name": clean(row["mainokved_name"]) if row else None,
                "region": clean(row["region"]) if row else None,
                "annual_revenue": clean(row["revenue_company"]) if row else None,
                "same_group": company_id in group_ids, "profile_available": row is not None}

    def market(self, row):
        code = prefix(row["mainokved_code"])
        values, total = self.peers.get(code, ([], 0.0))
        revenue = clean(row["revenue_company"])
        position = bisect_right(values, float(revenue)) if revenue is not None else None
        middle = len(values) // 2
        median = ((values[middle - 1] + values[middle]) / 2 if len(values) % 2 == 0
                  else values[middle]) if values else None
        return {"comparison_okved": code,
                "comparison_level": "first_two_digits_of_main_okved_code",
                "industry_peer_count": len(values),
                "industry_revenue_total_in_dataset": clean(total),
                "revenue_share_in_dataset": round(float(revenue) / total, 10) if revenue is not None and total else None,
                "revenue_percentile": round(position / len(values), 10) if position is not None and values else None,
                "revenue_rank": len(values) - position + 1 if position is not None else None,
                "revenue_to_industry_median": round(float(revenue) / median, 6) if revenue is not None and median else None,
                "calculation_scope": "companies_table_only",
                "percentile_method": "fraction_of_comparison_companies_with_revenue_less_than_or_equal_to_target"}

    def corporate_group(self, company_id, group):
        ids = set(group.synthetic_u)
        other = group[group.synthetic_u != company_id].sort_values(
            ["revenue_company", "synthetic_u"], ascending=[False, True], na_position="last")
        top = [{key: value for key, value in self.summary(id_, ids).items()
                if key not in ("same_group", "profile_available")}
               for id_ in other.synthetic_u.head(5)]
        return ({"group_id": group.iloc[0].group_id, "member_count": len(group),
                 "member_ids": sorted(ids, key=id_sort),
                 "group_revenue_sum": clean(float(group.revenue_company.sum())),
                 "group_revenue_is_consolidated": False,
                 "group_industries": [{"okved_prefix": str(k), "company_count": int(v)}
                                      for k, v in group.okved_prefix.value_counts().items()],
                 "group_regions": [{"value": str(k), "company_count": int(v)}
                                   for k, v in group.region.value_counts().head(20).items()],
                 "top_members": top}, ids)

    def payments(self, edges, other_key, group_ids):
        if edges is None:
            edges = pd.DataFrame(columns=[other_key, "pay_amt", "pay_cnt"])
        edges = edges.sort_values(["pay_amt", other_key], ascending=[False, True])
        amount = float(edges.pay_amt.sum())
        counterparties = edges[other_key].tolist()
        same_amount = float(edges.loc[[id_ in group_ids for id_ in counterparties], "pay_amt"].sum())
        known = edges.loc[[id_ in self.profiles for id_ in counterparties]].copy()
        known["region"] = known[other_key].map(lambda id_: self.profiles[id_]["region"])
        known["okved_prefix"] = known[other_key].map(
            lambda id_: prefix(self.profiles[id_]["mainokved_code"]))

        def breakdown(field):
            sums = known.groupby(field).pay_amt.sum().sort_values(ascending=False).head(10)
            return [{"value": str(k), "payment_amount": clean(float(v))} for k, v in sums.items()]

        top = []
        for edge in edges.head(10).to_dict("records"):
            item = self.summary(edge[other_key], group_ids)
            item.update(payment_amount=clean(edge["pay_amt"]), payment_count=clean(edge["pay_cnt"]),
                        share=round(float(edge["pay_amt"]) / amount, 10) if amount else None)
            top.append(item)
        result = {
            "total_amount": clean(amount), "payment_count": clean(edges.pay_cnt.sum()),
            "unique_counterparties": len(edges),
            "top1_share": round(float(edges.pay_amt.head(1).sum()) / amount, 10) if amount else None,
            "top5_share": round(float(edges.pay_amt.head(5).sum()) / amount, 10) if amount else None,
            "same_group_payment_amount": clean(same_amount),
            "same_group_payment_share": round(same_amount / amount, 10) if amount else None,
            "counterparties_with_profile": len(known),
            "counterparties_without_profile": len(edges) - len(known),
            "payment_amount_with_known_counterparty_profile": clean(float(known.pay_amt.sum())),
            "top_counterparties": top,
            "known_counterparty_industries": breakdown("okved_prefix"),
            "known_counterparty_regions": breakdown("region")}
        return result, set(edges[other_key])

    def person_links(self, company_id, group_ids):
        links = self.people_by_company.get(company_id)
        if links is None:
            links = pd.DataFrame(columns=["synthetic_f", "city_name", "rc_name"])
        links = links.drop_duplicates("synthetic_f")
        ids = sorted(links.synthetic_f.astype(str).tolist())
        related = Counter()
        for person_id in ids:
            for other_id in set(self.people_by_person[person_id].synthetic_u):
                if other_id != company_id:
                    related[other_id] += 1
        companies = []
        for other_id, count in sorted(related.items(), key=lambda x: (-x[1], x[0])):
            item = self.summary(other_id, group_ids)
            item["shared_person_count"] = count
            companies.append(item)
        return {"linked_person_count": len(ids), "linked_person_ids": ids,
                "linked_people": [{"person_id": str(r["synthetic_f"]),
                                   "city": clean(r["city_name"]), "region": clean(r["rc_name"])}
                                  for r in links.to_dict("records")],
                "related_company_count": len(companies), "related_companies": companies}

    def build(self, company_id):
        row = self.profiles[company_id]
        group, group_ids = self.corporate_group(company_id, self.groups[row["group_id"]])
        incoming, incoming_ids = self.payments(self.incoming.get(company_id), "payer", group_ids)
        outgoing, outgoing_ids = self.payments(self.outgoing.get(company_id), "beneficiary", group_ids)
        self_edges = self.self_payments[self.self_payments.payer == company_id]
        countries = clean(row["fts_country_name"])
        industry = category(prefix(row["mainokved_code"]))
        return {"company_id": company_id, "base_information": {
            "profile": {
                "org_type": clean(row["org_type"]), "ownership_form": clean(row["okfs_name"]),
                "industry": {"okved_code": clean(row["mainokved_code"]),
                             "okved_name": clean(row["mainokved_name"]),
                             "industry_category": industry,
                             "industry_category_source": "derived_from_okved_section_not_from_database" if industry else None},
                "age_band": clean(row["company_age_years_gradation"]),
                "development_stage": clean(row["eco_mark_label"]),
                "annual_revenue": clean(row["revenue_company"]),
                "employees": {"fns_band": clean(row["amount_workers_fns_gradation"]),
                              "spark_band": clean(row["amount_workers_spark_gradation"])},
                "geography": {"city": clean(row["city"]), "region": clean(row["region"]),
                              "fts_flag": flag(row["fts_flag"]),
                              "fts_countries": [x.strip() for x in countries.split(",") if x.strip()] if countries else []},
                "negative_mark_raw": clean(row["negativemark"])},
            "banking": {"client_type": clean(row["cl_type"]), "products": {
                "rko": flag(row["cl_product_rko_mark"]), "guarantees": flag(row["cl_product_gar_mark"]),
                "loans": flag(row["cl_product_loa_mark"]), "leasing": flag(row["cl_product_lea_mark"]),
                "deposits": flag(row["cl_product_dep_mark"]), "payroll": flag(row["cl_product_zpp_mark"]),
                "factoring": flag(row["factoring_mark"]) }},
            "market_position": self.market(row), "corporate_group": group,
            "payments": {"incoming": incoming, "outgoing": outgoing,
                         "unique_external_counterparties": len(incoming_ids | outgoing_ids)},
            "person_links": self.person_links(company_id, group_ids),
            "data_quality": {
                "sources": {"company_profile": "companies", "payments": "payments",
                            "person_company_links": "person_company_links"},
                "payment_period": None, "payment_currency": None,
                "revenue_reporting_period": None, "revenue_currency": None,
                "market_share_is_dataset_relative": True,
                "has_unresolved_company_id_conflict": False,
                "self_payments_excluded": True,
                "excluded_self_payment_rows": len(self_edges),
                "excluded_self_payment_amount": clean(float(self_edges.pay_amt.sum())),
                "excluded_self_payment_count": clean(self_edges.pay_cnt.sum()),
                "group_revenue_is_not_consolidated": True,
                "person_link_role_unspecified": True, "payment_purpose_unspecified": True,
                "counterparty_profile_coverage_incoming": round(incoming["counterparties_with_profile"] / incoming["unique_counterparties"], 6) if incoming["unique_counterparties"] else None,
                "counterparty_profile_coverage_outgoing": round(outgoing["counterparties_with_profile"] / outgoing["unique_counterparties"], 6) if outgoing["unique_counterparties"] else None,
            }}, "web_research": {}, "alfa_analytics": {}}


def build_all(output=OUTPUT, min_group_revenue=MIN_GROUP_REVENUE):
    engine = get_engine()
    try:
        with engine.connect() as connection:
            ids = select_company_ids(connection, min_group_revenue)
            print(f"Selected {len(ids)} companies", flush=True)
            companies = read_table(connection, "companies")
            people = read_table(connection, "people")
            builder = ContextBuilder(companies, people, ids)
            del companies, people
            output = Path(output)
            output.parent.mkdir(parents=True, exist_ok=True)
            temporary = output.with_suffix(output.suffix + ".tmp")
            try:
                with temporary.open("w", encoding="utf-8") as stream:
                    stream.write("[\n")
                    for start in range(0, len(ids), 100):
                        batch = ids[start:start + 100]
                        builder.load_payments(read_relevant_payments(connection, batch))
                        for index, company_id in enumerate(batch, start):
                            if index:
                                stream.write(",\n")
                            json.dump(builder.build(company_id), stream, ensure_ascii=False, allow_nan=False)
                        if (start + len(batch)) % 1000 == 0:
                            print(f"Built {start + len(batch)}/{len(ids)} companies", flush=True)
                    stream.write("\n]\n")
                temporary.replace(output)
            finally:
                temporary.unlink(missing_ok=True)
    finally:
        engine.dispose()
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-group-revenue", type=float, default=MIN_GROUP_REVENUE,
                        help="Strict minimum group revenue after client and placeholder filters")
    parser.add_argument("--no-group-revenue-limit", action="store_true",
                        help="Build contexts for every eligible client regardless of group revenue")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    threshold = None if args.no_group_revenue_limit else args.min_group_revenue
    count = build_all(args.output, threshold)
    print(f"Wrote {count} contexts to {args.output}")


if __name__ == "__main__":
    main()
