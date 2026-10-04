"""Convert the supplied Excel A/D columns into bundled data; no network/dependencies."""
import argparse
import json
import posixpath
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'smieszne_ciekawostki_na_rok_bez_niedziel.xlsx'
OUTPUT = ROOT / 'frontend/src/data/dailyFacts.json'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def validate_records(records):
    if not records:
        raise ValueError('Empty fact collection')
    seen = set()
    previous = None
    for record in records:
        day = date.fromisoformat(record['date'])
        if day.isoformat() != record['date'] or day in seen or day.weekday() == 6:
            raise ValueError(f'Invalid, duplicate or Sunday date: {record["date"]}')
        if not isinstance(record['text'], str) or not record['text'].strip():
            raise ValueError(f'Empty text: {day}')
        if previous:
            expected = previous + timedelta(days=1)
            if expected.weekday() == 6:
                expected += timedelta(days=1)
            if day != expected:
                raise ValueError(f'Missing or unordered date: expected {expected}, got {day}')
        seen.add(day)
        previous = day
    return records


def read_records(source):
    with ZipFile(source) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next(s for s in workbook.findall('s:sheets/s:sheet', NS)
                     if s.attrib['name'] == 'Ciekawostki')
        rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in relationships if r.attrib['Id'] == rel_id)
        sheet_path = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(s.itertext()) for s in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        properties = workbook.find('s:workbookPr', NS)
        epoch = date(1904, 1, 1) if properties is not None and properties.get('date1904') in ('1', 'true') else date(1899, 12, 30)
        records = []
        for row in ET.fromstring(archive.read(sheet_path)).findall('s:sheetData/s:row', NS):
            if int(row.attrib['r']) < 2:
                continue
            cells = {''.join(c for c in cell.attrib['r'] if c.isalpha()): cell for cell in row}
            def value(column):
                cell = cells.get(column)
                if cell is None:
                    return None
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Formulas are not supported in source A/D columns')
                kind = cell.get('t', 'n')
                if kind == 'inlineStr':
                    return ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                raw = cell.findtext('s:v', namespaces=NS)
                if kind == 's':
                    return shared[int(raw)]
                if column == 'A' and kind == 'n' and raw is not None:
                    serial = float(raw)
                    if not serial.is_integer():
                        raise ValueError('Dates must not contain time of day')
                    return (epoch + timedelta(days=int(serial))).isoformat()
                if column == 'A' and kind == 'd':
                    return raw[:10]
                return raw
            day, text = value('A'), value('D')
            if day is None and text is None:
                continue
            records.append({'date': day, 'text': text})
    return validate_records(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify the existing JSON without writing')
    args = parser.parse_args()
    records = read_records(SOURCE)
    if args.check:
        if json.loads(OUTPUT.read_text(encoding='utf-8')) != records:
            raise ValueError('Bundled facts differ from Excel A/D columns')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'count': len(records), 'from': records[0]['date'],
                      'to': records[-1]['date'], 'longest': max(len(r['text']) for r in records)}))


if __name__ == '__main__':
    main()
