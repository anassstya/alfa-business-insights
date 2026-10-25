"""Proposed ML interchange contract v1. These are not Supabase table models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, field_validator, model_validator


VERSION = "1.0"
Role = Literal["accountant", "ceo", "cfo", "decision_maker", "other_c_level", "owner", "treasurer"]
SourceKind = Literal["news", "official_release", "bank_research", "fixture"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_timezone(self):
        for name in type(self).model_fields:
            value = getattr(self, name)
            if isinstance(value, datetime) and value.utcoffset() is None:
                raise ValueError(f"{name} must include a timezone")
        return self


class Versioned(Contract):
    schema_version: Literal["1.0"] = VERSION


class BaseInformation(Contract):
    # The generator owns this nested business structure. Preserve all of its keys,
    # including null and zero, while checking the stable top-level sections.
    model_config = ConfigDict(extra="allow")
    profile: dict[str, Any]
    banking: dict[str, Any]
    market_position: dict[str, Any]
    corporate_group: dict[str, Any]
    payments: dict[str, Any]
    person_links: dict[str, Any]
    data_quality: dict[str, Any]


class BaseCompanyProfile(Versioned):
    company_id: str = Field(pattern=r"^U_[A-Za-z0-9_]+$", max_length=128)
    base_information: BaseInformation
    source: Literal["json", "supabase"]
    source_updated_at: datetime | None = None
    profile_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    warnings: list[str] = Field(default_factory=list, max_length=30)


class Exposure(Versioned):
    exposure_id: str = Field(max_length=80)
    factor: str = Field(max_length=160)
    feature_refs: list[str] = Field(max_length=20)
    observed_values: dict[str, Any] = Field(default_factory=dict)
    rule_id: str = Field(max_length=80)
    rule_version: str = Field(max_length=40)
    reason: str = Field(max_length=1200)
    assumptions: list[str] = Field(default_factory=list, max_length=20)
    missing_fields: list[str] = Field(default_factory=list, max_length=20)
    priority: int = Field(ge=0, le=100)


class SearchTask(Versioned):
    task_id: str = Field(max_length=80)
    exposure_ids: list[str] = Field(max_length=20)
    question: str = Field(max_length=500)
    query: str = Field(max_length=300)
    source_kind: SourceKind
    filters: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(ge=0, le=100)
    reason: str = Field(max_length=700)
    expected_evidence: str = Field(max_length=700)
    max_results: int = Field(ge=1, le=8)


class EvidenceRecord(Versioned):
    evidence_id: str = Field(max_length=80)
    document_id: str = Field(max_length=80)
    source_kind: SourceKind
    title: str = Field(max_length=500)
    publisher: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2048)
    published_at: datetime | None = None
    retrieved_at: datetime
    event_at: datetime | None = None
    excerpt: str = Field(max_length=4000)
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    page_number: PositiveInt | None = None
    date_status: Literal["known", "unknown", "archived"]
    content_status: Literal["full_text", "excerpt_only", "fetch_failed"]


class ResearchWindow(Contract):
    start: datetime
    end: datetime


class CompanyResearchContext(Versioned):
    company_id: str = Field(pattern=r"^U_[A-Za-z0-9_]+$", max_length=128)
    profile_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    as_of: datetime
    window: ResearchWindow
    exposures: list[Exposure] = Field(default_factory=list, max_length=50)
    tasks: list[SearchTask] = Field(default_factory=list, max_length=6)
    evidence: list[EvidenceRecord] = Field(default_factory=list, max_length=48)
    coverage: dict[str, Any] = Field(default_factory=dict)
    gaps: list[str] = Field(default_factory=list, max_length=30)
    versions: dict[str, str] = Field(default_factory=dict)
    expires_at: datetime | None = None


class BankView(Contract):
    status: Literal["available", "unavailable"] = "unavailable"
    text: str | None = Field(default=None, max_length=2000)
    report_at: datetime | None = None
    evidence_refs: list[str] = Field(default_factory=list, max_length=12)


class Insight(Versioned):
    insight_id: str = Field(max_length=80)
    event: str = Field(max_length=1000)
    company_relevance: str = Field(max_length=1500)
    role_relevance: str = Field(max_length=1500)
    impact_chain: list[str] = Field(max_length=8)
    bank_view: BankView = Field(default_factory=BankView)
    risks: list[str] = Field(default_factory=list, max_length=10)
    opportunities: list[str] = Field(default_factory=list, max_length=10)
    suggested_actions: list[str] = Field(default_factory=list, max_length=10)
    assumptions: list[str] = Field(default_factory=list, max_length=15)
    uncertainty: str = Field(max_length=1000)
    evidence_refs: list[str] = Field(max_length=12)
    feature_refs: list[str] = Field(max_length=20)
    rank: PositiveInt


class AnalysisRequest(Versioned):
    job_id: UUID
    company_row_id: PositiveInt
    company_id: str = Field(pattern=r"^U_[A-Za-z0-9_]+$", max_length=128)
    role: Role
    goal: str | None = Field(default=None, max_length=1000)
    as_of: datetime
    lookback_days: int = Field(default=30, ge=1, le=365)
    max_insights: int = Field(default=5, ge=0, le=5)


class StageEvent(Versioned):
    job_id: UUID
    run_id: UUID
    seq: PositiveInt
    stage: Literal["loading_profile", "mapping_exposures", "planning", "retrieving", "analyzing", "validating", "completed"]
    state: Literal["started", "completed", "failed", "skipped"]
    at: datetime
    summary: str = Field(max_length=500)
    counters: dict[str, int] = Field(default_factory=dict)


class AnalysisResult(Versioned):
    job_id: UUID
    run_id: UUID
    company_id: str = Field(pattern=r"^U_[A-Za-z0-9_]+$", max_length=128)
    company_row_id: PositiveInt
    role: Role
    goal: str | None = Field(default=None, max_length=1000)
    as_of: datetime
    mode: Literal["fixture", "live"] = "live"
    outcome: Literal["ok", "partial", "no_relevant_evidence", "failed"]
    insights: list[Insight] = Field(default_factory=list, max_length=5)
    evidence: list[EvidenceRecord] = Field(default_factory=list, max_length=48)
    profile_snapshot: BaseCompanyProfile | None = None
    research_context: CompanyResearchContext | None = None
    warnings: list[str] = Field(default_factory=list, max_length=30)
    trace: list[StageEvent] = Field(default_factory=list, max_length=100)
    usage: dict[str, Any] = Field(default_factory=dict)
    versions: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def check_outcome(self):
        if self.outcome == "ok" and not self.insights:
            raise ValueError("ok requires at least one insight")
        if self.outcome in ("failed", "no_relevant_evidence") and self.insights:
            raise ValueError("failed/no_relevant_evidence cannot contain insights")
        return self


MODELS = (BaseCompanyProfile, Exposure, SearchTask, EvidenceRecord,
          CompanyResearchContext, Insight, AnalysisRequest, AnalysisResult, StageEvent)
