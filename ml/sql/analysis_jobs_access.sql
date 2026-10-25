-- Run once in Supabase SQL Editor as the database owner.
-- Allows the existing server-side ml_agent role to persist analysis results.
-- Does not change the table structure or disable RLS.
BEGIN;

GRANT SELECT ON public.analysis_jobs TO ml_agent;
GRANT INSERT (id, company_id, role, goal, status, stage)
    ON public.analysis_jobs TO ml_agent;
GRANT UPDATE (status, stage, result, error_message, updated_at)
    ON public.analysis_jobs TO ml_agent;

DROP POLICY IF EXISTS ml_jobs_select ON public.analysis_jobs;
CREATE POLICY ml_jobs_select ON public.analysis_jobs
    FOR SELECT TO ml_agent USING (true);
DROP POLICY IF EXISTS ml_jobs_insert ON public.analysis_jobs;
CREATE POLICY ml_jobs_insert ON public.analysis_jobs
    FOR INSERT TO ml_agent WITH CHECK (true);
DROP POLICY IF EXISTS ml_jobs_update ON public.analysis_jobs;
CREATE POLICY ml_jobs_update ON public.analysis_jobs
    FOR UPDATE TO ml_agent USING (true) WITH CHECK (true);

COMMIT;
