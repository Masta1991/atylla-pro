from __future__ import annotations

import tempfile
from pathlib import Path

from check_skill_catalog import collect


def make_fixture(names: list[str], index_names: list[str], readme_names: list[str]):
    base = Path(tempfile.mkdtemp())
    root = base / "skills"
    root.mkdir()
    for name in names:
        folder = root / name
        folder.mkdir()
        (folder / "SKILL.md").write_text("---\nname: x\n---\n", encoding="utf-8")
    index = base / "SKILLS_INDEX.md"
    index.write_text("\n".join(f"- [{n}](skills/{n}/SKILL.md)" for n in index_names), encoding="utf-8")
    readme = root / "README.md"
    readme.write_text("\n".join(f"| `{n}` | x | [SKILL]({n}/SKILL.md) |" for n in readme_names), encoding="utf-8")
    return root, index, readme


def test_complete_catalog():
    result = collect(*make_fixture(["a", "b"], ["a", "b"], ["a", "b"]))
    assert result["status"] == "PASS"


def test_missing_and_orphan_entry():
    result = collect(*make_fixture(["a"], [], ["ghost"]))
    assert result["index"]["missing"] == ["a"]
    assert result["readme"]["dead"] == ["ghost"]


def test_missing_only_from_main_index():
    result = collect(*make_fixture(["cleanup"], [], ["cleanup"]))
    assert result["index"]["missing"] == ["cleanup"]
    assert result["readme"]["missing"] == []


def test_missing_only_from_skills_readme():
    result = collect(*make_fixture(["cleanup"], ["cleanup"], []))
    assert result["index"]["missing"] == []
    assert result["readme"]["missing"] == ["cleanup"]


def test_rename_is_missing_plus_dead_without_duplicate():
    result = collect(*make_fixture(["new-name"], ["old-name"], []))
    assert result["index"]["missing"] == ["new-name"]
    assert result["index"]["dead"] == ["old-name"]
    assert result["index"]["duplicates"] == []


def test_duplicate_entry():
    result = collect(*make_fixture(["a"], ["a", "a"], []))
    assert result["index"]["duplicates"] == ["a"]


if __name__ == "__main__":
    for test in (test_complete_catalog, test_missing_and_orphan_entry,
                 test_missing_only_from_main_index, test_missing_only_from_skills_readme,
                 test_rename_is_missing_plus_dead_without_duplicate,
                 test_duplicate_entry):
        test()
        print(f"PASS {test.__name__}")
