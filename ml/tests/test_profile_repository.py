import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

from ml.src.profile_repository import (
    AmbiguousCompanyIdentity, CompanyIdentityMismatch, CompanyNotFound,
    InvalidProfile, JsonCompanyProfileRepository, ProfileNotPrepared,
    ProfileStoreUnavailable, SupabaseCompanyProfileRepository, SupabaseSettings,
)
from ml.src.contracts import AnalysisResult, EvidenceRecord
from pydantic import ValidationError
from uuid import UUID


def payload(company_id="U_1", *, revenue=0, loans=False):
    return {"company_id": company_id, "base_information": {
        "profile": {"annual_revenue": revenue, "industry": {"okved_code": None}},
        "banking": {"products": {"loans": loans}}, "market_position": {},
        "corporate_group": {}, "payments": {}, "person_links": {},
        "data_quality": {"payment_period": None}}}


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "profiles.json"
        self.path.write_text(json.dumps([payload()]), encoding="utf-8")

    def repo(self, rows=None):
        return JsonCompanyProfileRepository(self.path, identity_rows=rows or {"U_1": [7]})

    def test_json_and_supabase_same_business_fields_and_hash(self):
        local = self.repo().get_company_profile("U_1", 7)
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.all.return_value = [(7, payload(), None)]
        remote = SupabaseCompanyProfileRepository(engine).get_company_profile("U_1", 7)
        self.assertEqual(local.base_information, remote.base_information)
        self.assertEqual(local.profile_hash, remote.profile_hash)
        self.assertEqual(local.base_information.profile["annual_revenue"], 0)
        self.assertIsNone(local.base_information.data_quality["payment_period"])
        self.assertEqual(remote.source, "supabase")
        self.assertEqual(conn.execute.call_count, 1)
        self.assertTrue(str(conn.execute.call_args.args[0]).lstrip().startswith("SELECT"))

    def test_identity_and_missing(self):
        with self.assertRaises(CompanyNotFound):
            self.repo().get_company_profile("U_absent")
        with self.assertRaises(CompanyIdentityMismatch):
            self.repo().get_company_profile("U_1", 8)
        with self.assertRaises(AmbiguousCompanyIdentity):
            self.repo({"U_1": [7, 8]}).get_company_profile("U_1")
        with self.assertRaises(ProfileNotPrepared):
            self.repo({"U_1": [7], "U_2": [9]}).get_company_profile("U_2")

    def test_resolve_numeric_and_synthetic_identity(self):
        local = self.repo()
        self.assertEqual(local.resolve_company_identity(7), ("U_1", 7))
        self.assertEqual(local.resolve_company_identity("U_1"), ("U_1", 7))
        with self.assertRaises(CompanyNotFound):
            local.resolve_company_identity(999)
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.all.return_value = [(7, "U_1")]
        remote = SupabaseCompanyProfileRepository(engine)
        self.assertEqual(remote.resolve_company_identity(7), ("U_1", 7))
        self.assertEqual(conn.execute.call_args.args[1], {"value": 7})
        conn.execute.return_value.all.return_value = [(7, "U_1"), (8, "U_1")]
        with self.assertRaises(AmbiguousCompanyIdentity):
            remote.resolve_company_identity("U_1")

    def test_incomplete_and_invalid(self):
        for content, exception in [
            ({"company_id": "U_1", "__base_context_upload_chunks__": {}}, ProfileNotPrepared),
            ({"company_id": "U_1"}, ProfileNotPrepared),
            ({**payload(), "base_information": None}, InvalidProfile),
            ({**payload(), "company_id": "U_2"}, InvalidProfile),
        ]:
            with self.subTest(content=content):
                self.path.write_text(json.dumps({"U_1": content}), encoding="utf-8")
                with self.assertRaises(exception):
                    self.repo().get_company_profile("U_1")

    def test_network_failure_and_settings(self):
        engine = MagicMock()
        engine.connect.side_effect = __import__("sqlalchemy").exc.OperationalError("SELECT", {}, Exception("offline"))
        with self.assertRaises(ProfileStoreUnavailable):
            SupabaseCompanyProfileRepository(engine).get_company_profile("U_1")
        with self.assertRaises(ProfileStoreUnavailable):
            SupabaseSettings({})
        config = {"POSTGRES_HOST": "db.example.com", "POSTGRES_PORT": "6543",
                  "POSTGRES_CONNECTION_MODE": "transaction", "POSTGRES_USER": "u",
                  "POSTGRES_PASSWORD": "secret", "POSTGRES_DB": "postgres"}
        self.assertIsNone(SupabaseSettings(config).connect_args["prepare_threshold"])

    def test_contract_outcome_and_dates(self):
        fields = dict(job_id=UUID(int=1), run_id=UUID(int=2), company_id="U_1",
                      company_row_id=7, role="cfo", as_of="2026-09-15T12:00:00+03:00")
        self.assertEqual(AnalysisResult(**fields, outcome="no_relevant_evidence").insights, [])
        with self.assertRaises(ValidationError):
            AnalysisResult(**fields, outcome="ok")
        with self.assertRaises(ValidationError):
            AnalysisResult(**{**fields, "as_of": "2026-09-15T12:00:00"}, outcome="failed")
        with self.assertRaises(ValidationError):
            EvidenceRecord(evidence_id="e1", document_id="d1", source_kind="news",
                           title="t", retrieved_at="2026-09-15T12:00:00+03:00",
                           excerpt="x", content_hash="0" * 64, page_number=0,
                           date_status="unknown", content_status="excerpt_only")


if __name__ == "__main__":
    unittest.main()
