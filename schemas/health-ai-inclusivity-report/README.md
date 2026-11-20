# Health-AI Dataset Inclusivity and Disclosure-Control Report

Apache-2.0 JSON Schema for sharing aggregate representation, subgroup model performance and disclosure-control evidence. The example simulates 2,000 people. It contains zero real patients.

Use the structural schema with a Draft 2020-12 validator. For Draft-07 tooling, change `$schema` to `http://json-schema.org/draft-07/schema#`. The keywords are shared by both drafts. The schema can be registered with a schema catalogue using the file's published URL.

```sh
npm install
unshare -c -p -f --mount-proc npm test
node validate-report.mjs examples/synthetic-2000-cohort-inclusivity-report.json
```

Use the Ajv-based validator when checking reports. It also checks rounding, subgroup counts, intervals and the declared minimum cell threshold across fields. The negative fixture has an unsuppressed cell below that threshold. A schema check alone cannot compare values in separate fields.

- Use `synthetic-example` and the exact synthetic label for simulated data. Use `in-environment-aggregated` and the aggregate label for evidence approved for release.
- Calculate eligibility from the underlying subgroup count in the authorised environment. Round released counts down to the declared base. Omit the count and all performance measures for suppressed groups. Review representation, missingness and overlapping totals separately for disclosure risk before release.
- Representation intervals describe uncertainty in cohort share. The disparity ratio divides cohort share by reference share. Document the interval method, flag threshold and calibration measure in the report's accompanying evaluation protocol.
- Clause references identify relevant evidence topics. The EU AI Act sets data governance requirements for applicable high-risk systems. EHDS sets distinct secondary-use and permit terms.

[EU AI Act, Article 10](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) · [EHDS Regulation](https://eur-lex.europa.eu/eli/reg/2025/327/oj/eng)
