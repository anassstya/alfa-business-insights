"""Read one company profile without running the batch generator.

From repository root: python -m ml.src.profile_cli U_1 --source json
"""

import argparse
import json

from .profile_repository import ROOT, JsonCompanyProfileRepository, SupabaseCompanyProfileRepository


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("company_id")
    parser.add_argument("--company-row-id", type=int)
    parser.add_argument("--source", choices=("json", "supabase"), required=True)
    args = parser.parse_args()
    if args.source == "json":
        repo = JsonCompanyProfileRepository(ROOT / "database/data/company_context.json")
    else:
        repo = SupabaseCompanyProfileRepository.from_env()
    try:
        profile = repo.get_company_profile(args.company_id, args.company_row_id)
        section = profile.base_information
        print(json.dumps({"company_id": profile.company_id, "source": profile.source,
                          "profile_hash": profile.profile_hash,
                          "industry": section.profile.get("industry", {}).get("okved_code"),
                          "region": section.profile.get("geography", {}).get("region"),
                          "warnings": profile.warnings}, ensure_ascii=False))
    finally:
        if args.source == "supabase":
            repo.close()


if __name__ == "__main__":
    main()
