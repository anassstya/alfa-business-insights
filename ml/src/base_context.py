"""Build company contexts and upsert them to Supabase.

Run: python ml/src/base_context.py --no-json
"""

from __future__ import annotations

import argparse
import json
import math
import os
import time
from bisect import bisect_right
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError as SqlAlchemyOperationalError
from sqlalchemy.pool import NullPool


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "database/data/company_context.json"
MIN_GROUP_REVENUE = 15_000_000_000
TABLES = {"companies": "companies", "people": "person_company_links", "payments": "payments"}
BUILD_BATCH_SIZE = 10
DIRECT_PAYLOAD_BYTES = 18_000
STAGE_CHUNK_BYTES = 14_000
UPLOAD_WORKERS = 2
STAGE_KEY = "__base_context_upload_chunks__"


UPSERT_SQL = """
        INSERT INTO public.company_contexts (company_id, payload)
        VALUES (%s, CAST(%s AS jsonb))
        ON CONFLICT (company_id) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = now()
    """
START_STAGING_SQL = f"""
        INSERT INTO public.company_contexts (company_id, payload)
        VALUES (%s, jsonb_build_object('company_id', CAST(%s AS text), '{STAGE_KEY}',
                                       jsonb_build_object('0', CAST(%s AS text))))
        ON CONFLICT (company_id) DO UPDATE
        SET payload = jsonb_set(public.company_contexts.payload, '{{{STAGE_KEY}}}',
                                EXCLUDED.payload -> '{STAGE_KEY}', true)
    """
APPEND_CHUNK_SQL = f"""
        UPDATE public.company_contexts
        SET payload = jsonb_set(payload, '{{{STAGE_KEY}}}',
                                (payload -> '{STAGE_KEY}') ||
                                jsonb_build_object(CAST(%s AS text), CAST(%s AS text)), true)
        WHERE company_id = %s AND payload ? '{STAGE_KEY}'
    """
FINISH_STAGING_SQL = f"""
        UPDATE public.company_contexts AS target
        SET payload = (
            SELECT string_agg(value #>> '{{}}', '' ORDER BY key::integer)::jsonb
            FROM jsonb_each(target.payload -> '{STAGE_KEY}')
        ), updated_at = now()
        WHERE company_id = %s AND payload ? '{STAGE_KEY}'
    """


def _db_settings():
    load_dotenv(ROOT / ".env", override=False)
    required = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise RuntimeError("Missing database settings: " + ", ".join(missing))
    return {"user": os.environ["POSTGRES_USER"], "password": os.environ["POSTGRES_PASSWORD"],
            "dbname": os.environ["POSTGRES_DB"], "host": os.getenv("POSTGRES_HOST", "localhost"),
            "port": int(os.getenv("POSTGRES_PORT", "15432"))}


def _writer_settings():
    settings = _db_settings()
    if settings["host"].endswith(".pooler.supabase.com"):
        settings["port"] = int(os.getenv("POSTGRES_UPLOAD_PORT", "6543"))
    settings.update(connect_timeout=5, autocommit=True,
                    sslmode=os.getenv("POSTGRES_SSLMODE", "require" if settings["host"].endswith("supabase.com") else "prefer"),
                    gssencmode="disable")
    return settings


def _retry_delay(exc, attempt):
    if "ECIRCUITBREAKER" in str(exc):
        print("Supavisor circuit breaker is active; waiting 125 seconds", flush=True)
        time.sleep(125)
    else:
        time.sleep(0.5 * (2 ** min(attempt, 4)))


def _open_writer(settings):
    for attempt in range(5):
        try:
            return psycopg.connect(**settings)
        except psycopg.OperationalError as exc:
            if attempt == 4:
                raise
            _retry_delay(exc, attempt)


def _write_once(settings, statement, params):
    """Send one statement through a fresh connection and retry lost connections."""
    for attempt in range(3):
        connection = None
        try:
            connection = _open_writer(settings)
            with connection.cursor() as cursor:
                cursor.execute(statement, params)
                if cursor.rowcount != 1:
                    raise RuntimeError("Context upload affected no rows")
            return
        except (psycopg.OperationalError, OSError) as exc:
            if attempt == 2:
                raise
            _retry_delay(exc, attempt)
        finally:
            if connection is not None:
                try:
                    connection.close()
                except OSError:
                    pass


def _utf8_chunks(value, max_bytes):
    raw = value.encode("utf-8")
    start = 0
    while start < len(raw):
        end = min(start + max_bytes, len(raw))
        while True:
            try:
                chunk = raw[start:end].decode("utf-8")
                break
            except UnicodeDecodeError:
                end -= 1
        yield chunk
        start = end


def _upload_context(context, settings):
    company_id = context["company_id"]
    payload = json.dumps(context, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    try:
        if len(payload.encode("utf-8")) <= DIRECT_PAYLOAD_BYTES:
            _write_once(settings, UPSERT_SQL, (company_id, payload))
            return
        chunks = iter(_utf8_chunks(payload, STAGE_CHUNK_BYTES))
        _write_once(settings, START_STAGING_SQL, (company_id, company_id, next(chunks)))
        for index, chunk in enumerate(chunks, start=1):
            _write_once(settings, APPEND_CHUNK_SQL, (str(index), chunk, company_id))
        _write_once(settings, FINISH_STAGING_SQL, (company_id,))
    except Exception as exc:
        raise RuntimeError(f"Failed to upload context for {company_id}") from exc


def _uploaded_ids(ids, settings):
    uploaded = set()
    for start in range(0, len(ids), 1000):
        connection = _open_writer(settings)
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT company_id FROM public.company_contexts WHERE company_id = ANY(%s) "
                    f"AND payload ? 'base_information' AND NOT payload ? '{STAGE_KEY}'",
                    (ids[start:start + 1000],),
                )
                uploaded.update(row[0] for row in cursor)
        finally:
            try:
                connection.close()
            except OSError:
                pass
    return uploaded


def get_engine():
    settings = _db_settings()
    port = (int(os.getenv("POSTGRES_READ_PORT", "6543"))
            if settings["host"].endswith(".pooler.supabase.com") else settings["port"])
    url = URL.create("postgresql+psycopg", username=settings["user"],
                     password=settings["password"], host=settings["host"],
                     port=port, database=settings["dbname"])
    return create_engine(url, connect_args={"connect_timeout": 5},
                         poolclass=NullPool, isolation_level="AUTOCOMMIT",
                         skip_autocommit_rollback=True)


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


def read_payments_with_retry(engine, ids):
    for attempt in range(5):
        try:
            with engine.connect() as connection:
                return read_relevant_payments(connection, ids)
        except Exception as exc:
            cause = exc
            while cause is not None and not isinstance(cause, (psycopg.OperationalError, SqlAlchemyOperationalError)):
                cause = cause.__cause__
            if cause is None or attempt == 4:
                raise
            print(f"Payment read connection lost; retrying batch ({attempt + 1}/4)", flush=True)
            _retry_delay(exc, attempt)


def read_initial_data(engine, min_group_revenue):
    for attempt in range(5):
        try:
            with engine.connect() as connection:
                ids = select_company_ids(connection, min_group_revenue)
                companies = read_table(connection, "companies")
                people = read_table(connection, "people")
                return ids, companies, people
        except Exception as exc:
            cause = exc
            while cause is not None and not isinstance(cause, (psycopg.OperationalError, SqlAlchemyOperationalError)):
                cause = cause.__cause__
            if cause is None or attempt == 4:
                raise
            print(f"Initial database read interrupted; retrying ({attempt + 1}/4)", flush=True)
            _retry_delay(exc, attempt)


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


def build_all(output=OUTPUT, min_group_revenue=MIN_GROUP_REVENUE, upload_to_db=True, resume=False):
    engine = get_engine()
    writer_settings = _writer_settings() if upload_to_db else None
    temporary = None
    try:
        ids, companies, people = read_initial_data(engine, min_group_revenue)
        print(f"Selected {len(ids)} companies", flush=True)
        uploaded_ids = _uploaded_ids(ids, writer_settings) if resume else set()
        pending_ids = [company_id for company_id in ids if company_id not in uploaded_ids]
        if resume:
            print(f"Resuming: {len(uploaded_ids)} contexts already present; {len(pending_ids)} remaining", flush=True)
        builder = ContextBuilder(companies, people, ids)
        del companies, people

        output_path = Path(output) if output is not None else None
        if output_path is not None:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = output_path.with_suffix(output_path.suffix + ".tmp")
            stream = temporary.open("w", encoding="utf-8")
        else:
            stream = None
        try:
            if stream:
                stream.write("[\n")
            count = len(uploaded_ids)
            with ThreadPoolExecutor(max_workers=UPLOAD_WORKERS) as uploader:
                for start in range(0, len(pending_ids), BUILD_BATCH_SIZE):
                    batch_ids = pending_ids[start:start + BUILD_BATCH_SIZE]
                    payments = read_payments_with_retry(engine, batch_ids)
                    builder.load_payments(payments)
                    contexts = [builder.build(company_id) for company_id in batch_ids]
                    if stream:
                        for context in contexts:
                            if count:
                                stream.write(",\n")
                            json.dump(context, stream, ensure_ascii=False, allow_nan=False)
                            count += 1
                    else:
                        count += len(contexts)
                    if upload_to_db:
                        futures = [uploader.submit(_upload_context, context, writer_settings)
                                   for context in contexts]
                        for future in as_completed(futures):
                            future.result()
                    if count and ((count - len(uploaded_ids)) % 100 == 0 or count == len(ids)):
                        action = "uploaded" if upload_to_db else "built"
                        print(f"Built and {action} {count}/{len(ids)} companies", flush=True)
            if stream:
                stream.write("\n]\n")
                stream.close()
                stream = None
            if upload_to_db:
                db_count = len(_uploaded_ids(ids, writer_settings))
                print(f"Verified {db_count}/{count} generated contexts in company_contexts.", flush=True)
                if db_count != len(ids):
                    raise RuntimeError(f"Only {db_count}/{len(ids)} contexts are complete in company_contexts")
        finally:
            if stream:
                stream.close()
        if temporary is not None:
            temporary.replace(output_path)
    except Exception:
        if temporary is not None and temporary.exists():
            temporary.unlink()
        raise
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
    parser.add_argument("--upload-to-db", dest="upload_to_db", action="store_true",
                        help="Upsert generated contexts into public.company_contexts (default)")
    parser.add_argument("--no-upload-to-db", dest="upload_to_db", action="store_false",
                        help="Build the local JSON file without writing to the database")
    parser.set_defaults(upload_to_db=True)
    parser.add_argument("--no-json", action="store_true",
                        help="Do not write a local JSON file (use with --upload-to-db)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip complete contexts already in company_contexts (requires --no-json)")
    args = parser.parse_args()
    if args.no_json and not args.upload_to_db:
        parser.error("--no-json requires --upload-to-db")
    if args.resume and (not args.no_json or not args.upload_to_db):
        parser.error("--resume requires --no-json and database upload")
    threshold = None if args.no_group_revenue_limit else args.min_group_revenue
    output = None if args.no_json else args.output
    count = build_all(output, threshold, args.upload_to_db, args.resume)
    if output is not None:
        print(f"Wrote {count} contexts to {output}")


if __name__ == "__main__":
    main()
