"""Bounded JSONB uploads over the current remote connection.

Large JSON is staged in bounded text chunks and published by one final UPDATE.
The old web_research remains readable until publication.
"""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import text


DIRECT_BYTES = 6_000
CHUNK_BYTES = 4_000


class JsonbWriteConflict(Exception):
    pass


def utf8_chunks(value: str):
    raw = value.encode("utf-8")
    start = 0
    while start < len(raw):
        end = min(start + CHUNK_BYTES, len(raw))
        while True:
            try:
                chunk = raw[start:end].decode("utf-8")
                break
            except UnicodeDecodeError:
                end -= 1
        yield chunk
        start = end


def update_jsonb(engine, *, table: str, column: str, where: str, params: dict,
                 document: str, destination: str | None = None):
    """Internal storage helper; SQL predicates come only from repository constants."""
    targets = {("company_contexts", "payload", "web_research"): "company_id"}
    returning = targets.get((table, column, destination))
    if returning is None:
        raise ValueError("unsupported JSONB storage target")
    values = dict(params)
    metadata = ", updated_at=now()"

    def execute(expression, parameters, *, condition="", final=False):
        query = text(f"UPDATE public.{table} SET {column}={expression}"
                     f"{metadata if final else ''} WHERE ({where}) {condition} RETURNING {returning}")
        # The engine is configured for AUTOCOMMIT. Avoid an extra COMMIT command
        # on this pooler; each UPDATE is already atomic and committed by PostgreSQL.
        with engine.connect() as conn:
            row = conn.execute(query, parameters).first()
        if row is None:
            raise JsonbWriteConflict("JSONB target missing, denied by RLS, or upload superseded")

    if len(document.encode("utf-8")) <= DIRECT_BYTES:
        expression = "CAST(:json_document AS jsonb)"
        if destination is not None:
            expression = f"jsonb_set({column}, '{{{destination}}}', {expression}, true)"
        execute(expression, {**values, "json_document": document}, final=True)
        return

    key = "__ml_jsonb_upload__"
    upload_id = str(uuid4())
    chunks = iter(utf8_chunks(document))
    stage = ("jsonb_build_object('upload_id', CAST(:upload_id AS text), "
             "'chunks', jsonb_build_object('0', CAST(:chunk AS text)))")
    execute(f"jsonb_set(COALESCE({column}, '{{}}'::jsonb), '{{{key}}}', {stage}, true)",
            {**values, "upload_id": upload_id, "chunk": next(chunks)})
    condition = f"AND {column} #>> '{{{key},upload_id}}' = :upload_id"
    for index, chunk in enumerate(chunks, 1):
        execute(f"jsonb_set({column}, ARRAY['{key}', 'chunks', CAST(:chunk_index AS text)], "
                "to_jsonb(CAST(:chunk AS text)), true)",
                {**values, "upload_id": upload_id, "chunk_index": str(index), "chunk": chunk},
                condition=condition)
    parsed = ("(SELECT string_agg(value #>> '{}', '' ORDER BY key::integer)::jsonb "
              f"FROM jsonb_each({column} #> '{{{key},chunks}}'))")
    expression = parsed if destination is None else \
        f"jsonb_set({column}, '{{{destination}}}', {parsed}, true) - '{key}'"
    execute(expression, {**values, "upload_id": upload_id}, condition=condition, final=True)


def read_web_research(engine, company_id: str):
    """Read bounded pieces of one immutable JSON version, without large wire responses."""
    import json

    with engine.connect() as conn:
        metadata = conn.execute(text("""SELECT
            octet_length((payload->'web_research')::text),
            length((payload->'web_research')::text), md5((payload->'web_research')::text)
            FROM public.company_contexts WHERE company_id=:id"""), {"id": company_id}).first()
    if metadata is None:
        raise JsonbWriteConflict("company context missing")
    if metadata[0] is None:
        return None
    if metadata[0] > 2 * 1024 * 1024:
        raise JsonbWriteConflict("saved research exceeds the 2 MiB read limit")
    parts = []
    for offset in range(1, metadata[1] + 1, 1000):
        with engine.connect() as conn:
            row = conn.execute(text("""SELECT
                substring((payload->'web_research')::text FROM :offset FOR 1000)
                FROM public.company_contexts WHERE company_id=:id
                  AND md5((payload->'web_research')::text)=:version"""),
                {"id": company_id, "offset": offset, "version": metadata[2]}).first()
        if row is None:
            raise JsonbWriteConflict("research changed while reading; retry with the new version")
        parts.append(row[0])
    return json.loads("".join(parts))
