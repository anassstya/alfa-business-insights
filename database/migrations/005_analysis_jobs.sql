CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY,

    company_id BIGINT NOT NULL REFERENCES companies(id),
    demo_user_id BIGINT REFERENCES demo_users(id),
    role TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending',
    stage TEXT,

    result JSONB,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_jobs_company_id
    ON analysis_jobs(company_id);

ALTER TABLE analysis_jobs
    ADD COLUMN goal TEXT;