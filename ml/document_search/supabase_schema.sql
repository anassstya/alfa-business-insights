-- Run once in Supabase SQL Editor. The document_chunks table must already exist.
create extension if not exists vector with schema extensions;

create table if not exists public.document_chunks (
    chunk_id text primary key,
    document_id text not null,
    source text not null,
    page_start integer not null,
    page_end integer not null,
    chunk_index integer not null,
    extraction_method text,
    content text not null,
    embedding extensions.vector(384),
    created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
    on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
    on public.document_chunks
    using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_document_chunks(
    query_embedding extensions.vector(384),
    match_count integer default 5
)
returns table (
    chunk_id text,
    document_id text,
    source text,
    page_start integer,
    page_end integer,
    extraction_method text,
    content text,
    similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
    select
        dc.chunk_id,
        dc.document_id,
        dc.source,
        dc.page_start,
        dc.page_end,
        dc.extraction_method,
        dc.content,
        (1 - (dc.embedding <=> query_embedding))::double precision as similarity
    from public.document_chunks as dc
    where dc.embedding is not null
    order by dc.embedding <=> query_embedding
    limit greatest(match_count, 1);
$$;
