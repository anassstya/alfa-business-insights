BEGIN;

ALTER TABLE analysis_jobs
    ADD COLUMN dispatched_at TIMESTAMPTZ,
    ADD COLUMN recovery_deadline TIMESTAMPTZ;

-- The old backend could call ML while a job still appeared pending.
-- Never automatically replay those ambiguous legacy jobs. Stop old instances
-- before applying this migration; deploy the new worker only after it commits.
UPDATE analysis_jobs
SET status = 'failed',
    error_message = 'backend_recovery_legacy_unknown: execution before migration cannot be determined; manual reconciliation required',
    updated_at = NOW()
WHERE status IN ('pending', 'running');

CREATE INDEX idx_analysis_jobs_pending_dispatch
    ON analysis_jobs (created_at, id)
    WHERE status = 'pending' AND dispatched_at IS NULL;
CREATE INDEX idx_analysis_jobs_recovery_deadline
    ON analysis_jobs (recovery_deadline)
    WHERE status = 'running';

COMMIT;
