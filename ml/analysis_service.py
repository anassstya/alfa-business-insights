"""Compatibility entry point; all analysis uses the established ML pipeline."""
from typing import get_args

from ml.src.company_analysis import analyze_company
from ml.src.contracts import Role

VALID_ROLES = set(get_args(Role))


def run_analysis(job_id, company_id, role, document_store=None):
    """Legacy caller support. PDF configuration now comes from the shared root env."""
    return analyze_company(company_id, role, job_id=job_id)
