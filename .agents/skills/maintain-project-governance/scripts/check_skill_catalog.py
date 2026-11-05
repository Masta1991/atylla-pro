#!/usr/bin/env python3
"""Read-only consistency check for the shared skill catalog."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


INDEX_RE = re.compile(r"skills/([A-Za-z0-9_-]+)/SKILL\.md")
README_RE = re.compile(r"\[SKILL\]\(([A-Za-z0-9_-]+)/SKILL\.md\)")


def collect(root: Path, index: Path, readme: Path) -> dict[str, object]:
    actual = sorted(
        p.name for p in root.iterdir()
        if p.is_dir() and (p / "SKILL.md").is_file()
    )
    index_names_raw = INDEX_RE.findall(index.read_text(encoding="utf-8"))
    readme_names_raw = README_RE.findall(readme.read_text(encoding="utf-8"))
    actual_set = set(actual)

    def audit(names: list[str]) -> dict[str, list[str]]:
        names_set = set(names)
        return {
            "indexed": sorted(names_set),
            "missing": sorted(actual_set - names_set),
            "dead": sorted(names_set - actual_set),
            "duplicates": sorted({name for name in names if names.count(name) > 1}),
        }

    index_audit = audit(index_names_raw)
    readme_audit = audit(readme_names_raw)
    issues = []
    for label, result in (("SKILLS_INDEX.md", index_audit), ("skills/README.md", readme_audit)):
        if result["missing"]:
            issues.append(f"{label} missing entry: {', '.join(result['missing'])}")
        if result["dead"]:
            issues.append(f"{label} dead entry: {', '.join(result['dead'])}")
        if result["duplicates"]:
            issues.append(f"{label} duplicate entry: {', '.join(result['duplicates'])}")
    return {
        "status": "PASS" if not issues else "FAIL",
        "actual": actual,
        "index": index_audit,
        "readme": readme_audit,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("C:/Projects/.agents/skills"))
    parser.add_argument("--index", type=Path, default=Path("C:/Projects/.agents/SKILLS_INDEX.md"))
    parser.add_argument("--readme", type=Path, default=Path("C:/Projects/.agents/skills/README.md"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = collect(args.root, args.index, args.readme)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(
            f"{result['status']}: actual={len(result['actual'])}, "
            f"SKILLS_INDEX.md={len(result['index']['indexed'])}, "
            f"skills/README.md={len(result['readme']['indexed'])}"
        )
        for issue in result["issues"]:
            print(f"- {issue}")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
