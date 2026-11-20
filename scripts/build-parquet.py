"""Generate the typed Parquet projection of the public gateway atlas."""

import argparse
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

TEXT = pa.string()
TEXT_LIST = pa.list_(TEXT)
BOOL = pa.bool_()
SCHEMA = pa.schema([
    ('gateway_id', TEXT),
    ('jurisdiction', TEXT),
    ('authority_name', TEXT),
    ('route_type', TEXT),
    ('legal_basis', TEXT),
    ('ai_secondary_use_scope', TEXT),
    ('spe_or_sde_required', BOOL),
    ('required_application_evidence', TEXT_LIST),
    ('subgroup_or_bias_evidence_expected', BOOL),
    ('disclosure_control_expected', BOOL),
    ('key_milestones_or_timelines', TEXT),
    ('official_source_urls', TEXT_LIST),
    ('presencis_canonical_url', TEXT),
])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('json_source', type=Path)
    parser.add_argument('parquet_output', type=Path)
    args = parser.parse_args()
    rows = json.loads(args.json_source.read_text(encoding='utf-8'))
    table = pa.Table.from_pylist(rows, schema=SCHEMA)
    if table.to_pylist() != rows:
        raise ValueError('Parquet projection changed atlas data')
    pq.write_table(table, args.parquet_output, compression='zstd')


if __name__ == '__main__':
    main()
