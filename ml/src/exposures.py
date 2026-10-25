"""Deterministic research hypotheses over the prepared company profile.

Sources: context/matrica_priznakov.xlsx, sheet 1 rows 2-14;
context/Памятка*, section 4; context/IMPLEMENTATION_PLAN.md section 5.
The matrix suggests topics, never establishes an impact or counterparty identity.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .contracts import BaseCompanyProfile, Exposure, Role


RULE_VERSION = "1.0"
CONCENTRATION_THRESHOLDS = {"elevated": 0.30, "high": 0.50}  # strict >
ROLE_WEIGHTS: dict[str, dict[str, int]] = {
    "cfo": {"funding": 12, "liquidity": 10, "payments": 8, "demand": 3},
    "treasurer": {"funding": 10, "liquidity": 14, "trade": 8, "payments": 7},
    "ceo": {"demand": 12, "operations": 10, "payments": 8, "funding": 3},
    "owner": {"group": 14, "demand": 8, "funding": 6},
    "accountant": {"regulation": 12, "payments": 8, "funding": 2},
    "other_c_level": {"operations": 8, "demand": 7, "funding": 4},
    "decision_maker": {"demand": 7, "operations": 7, "funding": 5},
}


@dataclass(frozen=True)
class Rule:
    rule_id: str
    path: str
    factor: str
    topics: tuple[str, ...]
    reason: str
    missing: tuple[str, ...]
    assumptions: tuple[str, ...]
    priority: int
    category: str
    source: str


PRODUCT_RULES = (
    Rule("loan_product", "/banking/products/loans", "funding_terms",
         ("new borrowing rates", "refinancing terms"),
         "Loan product flag warrants checking financing terms; current debt sensitivity is unknown.",
         ("loan balance", "maturity", "fixed or floating rate"),
         ("Product flag does not measure debt." ,), 66, "funding", "matrix:2; plan:5"),
    Rule("deposit_product", "/banking/products/deposits", "deposit_terms",
         ("deposit rates", "liquidity placement terms"),
         "Deposit product flag warrants checking terms for new placements.",
         ("current balance", "placement maturity", "free cash"),
         ("Product flag does not establish available liquidity.",), 52, "liquidity", "matrix:4; plan:5"),
    Rule("leasing_product", "/banking/products/leasing", "equipment_financing",
         ("leasing rates", "equipment investment demand"),
         "Leasing product flag suggests checking equipment financing conditions.",
         ("asset type", "contract terms", "imported equipment status"),
         ("Foreign exchange exposure requires independent confirmation.",), 55, "funding", "matrix:3; plan:5"),
    Rule("guarantee_product", "/banking/products/guarantees", "guarantee_terms",
         ("bank guarantee conditions", "contract performance requirements"),
         "Guarantee product flag suggests checking guarantee and contract conditions.",
         ("contract type", "beneficiary", "public procurement status"),
         ("A guarantee does not establish a government contract.",), 51, "regulation", "matrix:5; plan:5"),
    Rule("factoring_product", "/banking/products/factoring", "receivables_financing",
         ("factoring rates", "settlement terms"),
         "Factoring flag suggests checking working-capital financing terms.",
         ("receivables volume", "payment terms", "contract type"),
         ("Factoring does not establish overdue receivables or a cash gap.",), 54, "funding", "matrix:6; plan:5"),
)

GENERAL_RULES = (
    Rule("fts_signal", "/profile/geography/fts_flag", "cross_border_trade",
         ("trade regulation", "currency settlement", "cross-border logistics"),
         "FTS flag makes cross-border channels worth verifying.",
         ("import or export direction", "volume", "trade date", "contract currency"),
         ("FTS flag does not establish import or export.",), 59, "trade", "matrix:7; plan:5"),
    Rule("registered_region", "/profile/geography/region", "regional_conditions",
         ("regional regulation", "regional demand", "regional infrastructure"),
         "Registration region is a candidate geography for research.",
         ("operating sites", "production location", "supply routes"),
         ("Registration does not locate operations.",), 43, "operations", "matrix:10; plan:5"),
    Rule("labor_signal", "/profile/employees", "labor_costs",
         ("labor market", "wage conditions"),
         "Employee band or payroll flag makes labor conditions worth checking.",
         ("actual headcount", "payroll size", "staff geography"),
         ("Payroll product alone does not establish a large workforce.",), 45, "operations", "matrix:9; plan:5"),
    Rule("group_signal", "/corporate_group/group_id", "group_links",
         ("related industry developments", "intragroup flows"),
         "Shared dataset group makes member industries and internal flows candidates for review.",
         ("legal ownership", "control", "consolidated revenue"),
         ("Shared GROUP_ID does not establish legal structure.",), 48, "group", "matrix:11; plan:5"),
)

INDUSTRY_RULES = (
    ("07.29.41", "gold_mining", "gold_output", ("gold prices", "mining costs"), "A gold-mining code suggests checking output price and extraction costs, conditional on actual product mix."),
    ("32.12", "jewelry", "gold_input", ("gold input prices", "jewelry demand"), "A jewelry-manufacturing code suggests checking gold input costs and product demand, conditional on actual material mix."),
    ("41.10", "developer", "real_estate_demand", ("housing demand", "mortgage conditions", "project finance"), "Development-project code suggests checking buyer demand and project funding; actual business model needs confirmation."),
    ("41.20", "construction", "construction_contracts", ("construction materials", "contractor orders", "customer payment terms"), "Building-construction code suggests checking contractor inputs and orders; developer activity is not established."),
    ("46.90", "wholesale", "wholesale_demand", ("wholesale demand", "inventory costs"), "Wholesale code suggests checking trade demand and stock costs; product mix is unknown."),
    ("56.10", "food_service", "food_service_demand", ("food service demand", "food input prices"), "Food-service code suggests checking customer demand and food costs; channel mix is unknown."),
    ("62.01", "software", "software_services", ("software demand", "IT labor market"), "Software-development code suggests checking service demand and specialist labor costs."),
)


def _get(data: dict[str, Any], path: str) -> Any:
    value: Any = data
    for key in path.strip("/").split("/"):
        if isinstance(value, dict):
            value = value.get(key)
        elif isinstance(value, list) and key.isdecimal() and int(key) < len(value):
            value = value[int(key)]
        else:
            return None
    return value


def build_exposures(profile: BaseCompanyProfile, role: Role, goal: str | None) -> list[Exposure]:
    """Map observed features to hypotheses; goal is untrusted task data, not a rule."""
    if not isinstance(profile, BaseCompanyProfile):
        profile = BaseCompanyProfile.model_validate(profile)
    if role not in ROLE_WEIGHTS:
        raise ValueError(f"Unknown role: {role}")
    base = profile.base_information.model_dump()
    weights = ROLE_WEIGHTS[role]
    result: list[Exposure] = []

    def add(rule: Rule, *, refs: list[str] | None = None, values: dict[str, Any] | None = None,
            missing: list[str] | None = None, assumptions: list[str] | None = None,
            bonus: int = 0, suffix: str = "") -> None:
        paths = refs or [rule.path]
        observed = values if values is not None else {"/base_information" + p: _get(base, p) for p in paths}
        # Scale, age and stage affect research order only. Their units or labels
        # cannot establish debt, maturity, business model, or event impact.
        modifiers = ("/profile/annual_revenue", "/profile/age_band", "/profile/development_stage")
        known_modifiers = [p for p in modifiers if _get(base, p) not in (None, "", "unknown")]
        priority = min(100, rule.priority + weights.get(rule.category, 0) + bonus + min(3, len(known_modifiers)))
        result.append(Exposure(
            exposure_id=rule.rule_id + suffix, rule_id=rule.rule_id,
            rule_version=RULE_VERSION, factor=rule.factor,
            search_topics=list(rule.topics),
            feature_refs=["/base_information" + p for p in paths + known_modifiers],
            observed_values=observed | {"/base_information" + p: _get(base, p) for p in known_modifiers},
            reason=rule.reason + f" Rule source: {rule.source}.",
            missing_fields=missing if missing is not None else list(rule.missing),
            assumptions=assumptions if assumptions is not None else list(rule.assumptions),
            priority=priority))

    for rule in PRODUCT_RULES:
        if _get(base, rule.path) is True:
            add(rule)
    for rule in GENERAL_RULES:
        value = _get(base, rule.path)
        if rule.rule_id == "labor_signal":
            employees = value if isinstance(value, dict) else {}
            payroll = _get(base, "/banking/products/payroll")
            if any(employees.get(k) is not None for k in ("fns_band", "spark_band")) or payroll is True:
                add(rule, refs=[rule.path, "/banking/products/payroll"])
        elif rule.rule_id == "group_signal":
            if value is not None and (_get(base, "/corporate_group/member_count") or 0) > 1:
                add(rule, refs=[rule.path, "/corporate_group/member_count"])
        elif value is True if rule.rule_id == "fts_signal" else bool(value):
            refs = [rule.path]
            if rule.rule_id == "fts_signal":
                refs.append("/profile/geography/fts_countries")
            add(rule, refs=refs)

    code = _get(base, "/profile/industry/okved_code")
    code = str(code) if code is not None else None
    match = next((x for x in INDUSTRY_RULES if code == x[0] or (code and code.startswith(x[0] + "."))), None)
    if code:
        if match:
            _, name, factor, topics, reason = match
            rule = Rule("industry_" + name, "/profile/industry/okved_code", factor,
                        topics, reason, ("actual product mix", "revenue channels", "cost structure"),
                        ("OKVED is a classification, not a verified business model.",), 57,
                        "demand", "matrix:8; memo:4; plan:5")
        else:
            rule = Rule("industry_general", "/profile/industry/okved_code", "industry_conditions",
                        ("industry demand", "industry regulation"),
                        "OKVED suggests broad industry topics only; detailed business activity is unverified.",
                        ("actual products", "customers", "cost structure"),
                        ("No detailed industry mechanism is inferred.",), 39, "demand", "matrix:8; plan:5")
        add(rule, refs=[rule.path, "/profile/industry/okved_name"])

    for direction in ("incoming", "outgoing"):
        branch = _get(base, "/payments/" + direction)
        if not isinstance(branch, dict):
            continue
        tops = branch.get("top_counterparties") or []
        for index, item in enumerate(tops):
            if not isinstance(item, dict):
                continue
            share = item.get("share")
            if isinstance(share, bool) or not isinstance(share, (int, float)) or not 0 <= share <= 1:
                continue
            band = "high" if share > CONCENTRATION_THRESHOLDS["high"] else "elevated" if share > CONCENTRATION_THRESHOLDS["elevated"] else None
            if band is None:
                continue
            path = f"/payments/{direction}/top_counterparties/{index}"
            rule = Rule("payment_concentration_" + direction, path + "/share",
                        "payment_concentration_" + direction,
                        ("counterparty industry conditions", "counterparty region conditions"),
                        f"A top {direction} payment counterparty exceeds the configured {band} share threshold; this measures recorded payment flow only.",
                        ("payment period", "payment purpose", "commercial relationship", "counterparty identity"),
                        ("Payment does not prove purchase, supply, or dependence; same_group=false only means no known group match.",
                         "Top-10 cannot establish exact external-group concentration."),
                        55, "payments", "matrix:11; plan:5")
            refs = [rule.path, path + "/same_group", path + "/okved_code", path + "/region",
                    f"/payments/{direction}/same_group_payment_share"]
            add(rule, refs=refs, bonus=8 if band == "high" else 0,
                suffix=f"_{index}_{band}")
    return sorted(result, key=lambda e: (-e.priority, e.exposure_id))
