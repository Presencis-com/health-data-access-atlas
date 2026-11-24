# Global Health Data Access & Secondary-Use AI Gateway Atlas

Compare research data access, medical device evidence and privacy rules across 11 entries. Each row cites official sources. The atlas contains regulatory summaries and links. It contains no patient data.

- [Atlas for readers](ATLAS.md)
- [Source JSON](data/gateways.json)
- [Generated CSV](data/gateways.csv)

The `route_type` field distinguishes research access, device evidence and privacy rules. True flags describe the named route. False flags mean the cited route has no general requirement of that kind. Dataset owners and applicable laws can impose separate conditions. Lists in the CSV are JSON arrays and flags are `true` or `false`. Parquet uses native list and boolean types.

## Build and verify

Node.js 22 and Python with the pinned PyArrow dependency are used to generate the files. The dataset and explorer read local snapshots.

```sh
python3 -m pip install -r requirements.txt
node scripts/build-atlas.mjs
python3 scripts/build-parquet.py data/gateways.json /path/to/data/train-00000-of-00001.parquet
unshare -c -p -f --mount-proc node --test test/atlas.test.mjs
unshare -c -p -f --mount-proc python3 tests/verify_atlas.py /path/to/data/train-00000-of-00001.parquet
```

The Python check accepts `--dump-text` with an output path to inspect decoded Parquet rows, schema and metadata. When changing a row, regenerate the CSV, reader atlas and Parquet file, then update the explorer and Regulatory MCP JSON snapshots.

## Related Documentation

- [EHDS Regulatory Guide](https://presencis.com/regulations/ehds/) · [Healthcare Sector Hub](https://presencis.com/sectors/health/)
- [NHS DCB0129](https://presencis.com/regulations/dcb0129/) · [NHS DCB0160](https://presencis.com/regulations/dcb0160/) · [NHS DTAC](https://presencis.com/regulations/dtac/) · [Full Regulatory Corpus](https://presencis.com/regulations/)
- [Interactive Explorer (Hugging Face Space)](https://huggingface.co/spaces/presencis/health-data-access-explorer) · [Parquet Dataset (Hugging Face)](https://huggingface.co/datasets/presencis/health-data-access-atlas)
- [Presencis Regulatory MCP (`@presencis/regulatory-mcp`)](https://github.com/Presencis-com/regulatory-mcp)
