"""Resolve frontend source cards from the evidence captured by the pipeline."""

from __future__ import annotations

from .contracts import AnalysisResult


def resolve_result_sources(result: AnalysisResult) -> AnalysisResult:
    records = {}
    if result.research_context is not None:
        records.update((e.evidence_id, e) for e in result.research_context.evidence)
    records.update((e.evidence_id, e) for e in result.evidence)
    insights, used = [], {}
    for insight in result.insights:
        quotes = {s.get("evidence_id"): s.get("quote") for s in insight.evidence_sources}
        sources = []
        for ref in insight.evidence_refs:
            if ref not in records:
                raise ValueError("insight references missing evidence")
            source = records[ref]
            quote = quotes.get(ref) or source.excerpt
            if " ".join(quote.casefold().split()) not in " ".join(source.excerpt.casefold().split()):
                raise ValueError("source quote does not match evidence")
            sources.append({
                "evidence_id": ref, "title": source.title,
                "publisher": source.publisher, "url": source.url,
                "source_kind": source.source_kind,
                "published_at": source.published_at.isoformat() if source.published_at else None,
                "retrieved_at": source.retrieved_at.isoformat(),
                "page_number": source.page_number, "quote": quote,
            })
            used[ref] = source
        insights.append(insight.model_copy(update={"evidence_sources": sources}, deep=True))
    return result.model_copy(update={"insights": insights, "evidence": list(used.values())}, deep=True)
