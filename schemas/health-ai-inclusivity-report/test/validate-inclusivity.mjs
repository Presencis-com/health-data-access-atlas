import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import Ajv from 'ajv';

import { createValidator } from '../validate-report.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const schema = read('../health-ai-inclusivity-report.schema.json');
const draft07 = { ...schema, $schema: 'http://json-schema.org/draft-07/schema#' };
const synthetic = read('../examples/synthetic-2000-cohort-inclusivity-report.json');
const invalid = read('../examples/invalid-unsuppressed-small-cell.json');

test('schema compiles under both drafts', () => {
  const current = new Ajv2020({ strict: true }).compile(schema);
  const legacy = new Ajv({ strict: true }).compile(draft07);
  for (const validate of [current, legacy]) {
    assert.equal(validate(synthetic), true, JSON.stringify(validate.errors));
    for (const change of [
      report => { report.data_classification = 'other'; },
      report => { delete report.label; },
      report => { report.subgroup_performance[1].ppv = 0.5; },
      report => { report.subgroup_performance[1].sensitivity = 0.5; },
      report => { report.subgroup_performance[0].specificity = 1.1; },
      report => { report.cohort_size_rounded = 0; },
      report => { report.regulatory_clause_refs = []; },
      report => { report.extra = true; },
    ]) {
      const report = structuredClone(synthetic);
      change(report);
      assert.equal(validate(report), false);
    }
  }
});

test('rejects an unsuppressed small cell below the declared threshold', () => {
  const validate = createValidator();
  assert.deepEqual(validate(synthetic), { valid: true, errors: [] });
  assert.deepEqual(validate(invalid), {
    valid: false,
    errors: ['subgroup_performance[1]: unsuppressed cell is below min_cell_threshold'],
  });
  const boundary = structuredClone(invalid);
  boundary.subgroup_performance[1].cell_size_rounded = boundary.disclosure_control.min_cell_threshold;
  assert.equal(validate(boundary).valid, true);
});

test('checks rounding, suppression totals, shares and interval order', () => {
  const validate = createValidator();
  for (const [change, expected] of [
    [r => { r.cohort_size_rounded = 2003; }, /cohort_size_rounded/],
    [r => { r.subgroup_performance[0].cell_size_rounded = 2010; }, /exceeds cohort_size_rounded/],
    [r => { r.subgroup_performance[0].cell_size_rounded = 2001; r.cohort_size_rounded = 2010; }, /multiple of rounding_base/],
    [r => { r.disclosure_control.small_cells_suppressed_count = 0; }, /small_cells_suppressed_count/],
    [r => { r.representation_ratios[0].ci_95_low = 0.99; }, /confidence interval/],
    [r => { r.subgroup_performance.push(r.subgroup_performance[0]); }, /duplicate group/],
  ]) {
    const report = structuredClone(synthetic);
    change(report);
    assert.ok(validate(report).errors.some(error => expected.test(error)), String(expected));
  }
});
