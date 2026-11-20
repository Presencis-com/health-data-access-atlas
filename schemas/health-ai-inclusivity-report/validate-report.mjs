import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(
  new URL('./health-ai-inclusivity-report.schema.json', import.meta.url), 'utf8',
));

export function createValidator() {
  const validateShape = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  return report => {
    if (!validateShape(report)) {
      return {
        valid: false,
        errors: validateShape.errors.map(error => `${error.instancePath || '/'}: ${error.message}`),
      };
    }

    const errors = [];
    const { min_cell_threshold, rounding_base, small_cells_suppressed_count } = report.disclosure_control;
    const cohort = report.cohort_size_rounded;
    if (cohort % rounding_base !== 0) {
      errors.push('cohort_size_rounded: must be a multiple of rounding_base');
    }

    function checkCount(count, field) {
      if (count % rounding_base !== 0) errors.push(`${field}: must be a multiple of rounding_base`);
      if (count > cohort) errors.push(`${field}: exceeds cohort_size_rounded`);
    }

    for (const [index, entry] of report.missingness_summary.entries()) {
      checkCount(entry.missing_count_rounded, `missingness_summary[${index}].missing_count_rounded`);
    }
    for (const [index, entry] of report.representation_ratios.entries()) {
      if (entry.ci_95_low > entry.cohort_share || entry.cohort_share > entry.ci_95_high) {
        errors.push(`representation_ratios[${index}]: confidence interval must contain the cohort share`);
      }
    }

    const groups = new Set();
    let suppressed = 0;
    for (const [index, entry] of report.subgroup_performance.entries()) {
      const field = `subgroup_performance[${index}]`;
      if (groups.has(entry.group)) errors.push(`${field}: duplicate group`);
      groups.add(entry.group);
      if (entry.suppressed) {
        suppressed++;
        continue;
      }
      checkCount(entry.cell_size_rounded, `${field}.cell_size_rounded`);
      if (entry.cell_size_rounded < min_cell_threshold) {
        errors.push(`${field}: unsuppressed cell is below min_cell_threshold`);
      }
    }
    if (suppressed !== small_cells_suppressed_count) {
      errors.push('small_cells_suppressed_count: must match the number of suppressed subgroup rows');
    }
    return { valid: errors.length === 0, errors };
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , file, ...extra] = process.argv;
  if (!file || extra.length) {
    console.error('Usage: node validate-report.mjs <report.json>');
    process.exitCode = 2;
  } else {
    try {
      const report = JSON.parse(readFileSync(file, 'utf8'));
      const result = createValidator()(report);
      if (result.valid) console.log('Valid report');
      else {
        console.error(result.errors.join('\n'));
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
