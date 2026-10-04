"""Read-only source parity and invalid input checks for the daily fact importer."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('daily_facts_import', ROOT / 'scripts/import-daily-facts.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class DailyFactImportTests(unittest.TestCase):
    def test_complete_source_matches_bundle(self):
        if not importer.SOURCE.exists():
            self.skipTest('Source XLSX stays local; run parity in the canonical workspace')
        actual = importer.read_records(importer.SOURCE)
        bundled = json.loads(importer.OUTPUT.read_text(encoding='utf-8'))
        self.assertEqual(actual, bundled)
        self.assertEqual(len(actual), 313)
        self.assertEqual(actual[0]['date'], '2026-10-05')
        self.assertEqual(actual[-1]['date'], '2027-10-04')
        self.assertEqual(max(len(row['text']) for row in actual), 298)

    def test_rejects_invalid_collections(self):
        row = {'date': '2026-10-05', 'text': '😀 Żółć — bez zmian.'}
        cases = [[], [row, row], [dict(row, text='  ')], [dict(row, text=None)],
                 [dict(row, date='2026-02-30')], [dict(row, date='2026-10-04')],
                 [row, dict(row, date='2026-10-07')]]
        for records in cases:
            with self.subTest(records=records), self.assertRaises(ValueError):
                importer.validate_records(records)

    def test_preserves_text_and_skips_only_sunday(self):
        records = [{'date': '2026-10-10', 'text': '  🥸 Żółć\n— dokładny tekst!  '},
                   {'date': '2026-10-12', 'text': 'Poniedziałek'}]
        self.assertIs(importer.validate_records(records), records)
        self.assertEqual(records[0]['text'], '  🥸 Żółć\n— dokładny tekst!  ')


if __name__ == '__main__':
    unittest.main()
