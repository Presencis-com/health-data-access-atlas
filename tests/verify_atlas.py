"""Verify exact value and type parity across the released atlas formats."""

import argparse
import csv
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
BOOLEAN_FIELDS = (
    'spe_or_sde_required', 'subgroup_or_bias_evidence_expected', 'disclosure_control_expected',
)
LIST_FIELDS = ('required_application_evidence', 'official_source_urls')
COLUMNS = [
    'gateway_id', 'jurisdiction', 'authority_name', 'route_type', 'legal_basis',
    'ai_secondary_use_scope', 'spe_or_sde_required', 'required_application_evidence',
    'subgroup_or_bias_evidence_expected', 'disclosure_control_expected',
    'key_milestones_or_timelines', 'official_source_urls', 'presencis_canonical_url',
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def csv_rows(path):
    with path.open(encoding='utf-8', newline='') as stream:
        reader = csv.DictReader(stream, strict=True)
        require(reader.fieldnames == COLUMNS, 'CSV columns differ')
        rows = []
        for line, row in enumerate(reader, start=2):
            require(set(row) == set(COLUMNS) and None not in row.values(), f'CSV row {line} width differs')
            for key in BOOLEAN_FIELDS:
                value = row[key]
                require(value in ('true', 'false'), f'CSV row {line} has invalid boolean {key}')
                row[key] = value == 'true'
            for key in LIST_FIELDS:
                row[key] = json.loads(row[key])
            rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('parquet', type=Path)
    parser.add_argument('--csv', type=Path, default=ROOT / 'data/gateways.csv')
    parser.add_argument('--dump-text', type=Path)
    args = parser.parse_args()
    rows = json.loads((ROOT / 'data/gateways.json').read_text(encoding='utf-8'))
    require(len(rows) == 11 and all(set(row) == set(COLUMNS) for row in rows), 'JSON row shape differs')
    require(csv_rows(args.csv) == rows, 'CSV rows differ from JSON')

    parquet = pq.ParquetFile(args.parquet)
    table = parquet.read()
    require(table.column_names == COLUMNS, 'Parquet columns differ')
    for field in table.schema:
        expected = pa.bool_() if field.name in BOOLEAN_FIELDS else pa.string()
        if field.name in LIST_FIELDS:
            expected = pa.list_(pa.string())
        require(field.type == expected, f'Parquet column {field.name} has wrong type')
    require(table.to_pylist() == rows, 'Parquet rows differ from JSON')
    if args.dump_text:
        metadata = parquet.metadata
        args.dump_text.write_text(json.dumps({
            'rows': table.to_pylist(),
            'schema': str(table.schema),
            'created_by': metadata.created_by,
            'metadata': {key.decode(): value.decode() for key, value in (metadata.metadata or {}).items()},
        }, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'JSON, CSV and typed Parquet match across {len(rows)} gateways')


if __name__ == '__main__':
    main()
