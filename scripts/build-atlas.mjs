import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fieldTypes = {
  gateway_id: 'text',
  jurisdiction: 'text',
  authority_name: 'text',
  route_type: 'text',
  legal_basis: 'text',
  ai_secondary_use_scope: 'text',
  spe_or_sde_required: 'boolean',
  required_application_evidence: 'list',
  subgroup_or_bias_evidence_expected: 'boolean',
  disclosure_control_expected: 'boolean',
  key_milestones_or_timelines: 'text',
  official_source_urls: 'list',
  presencis_canonical_url: 'text',
};
const fields = Object.keys(fieldTypes);
const routeTypes = new Set(['research-access', 'device-evidence', 'privacy-rule']);
const canonical = new Set([
  'https://presencis.com/regulations/',
  'https://presencis.com/regulations/ehds/',
  'https://presencis.com/solutions/aegis/',
]);
const primaryHosts = new Set([
  'digital.nhs.uk', 'eur-lex.europa.eu', 'findata.fi', 'health.ec.europa.eu',
  'publications.europa.eu', 'www.bfarm.de', 'www.canada.ca', 'www.cnil.fr',
  'www.elegislation.gov.hk', 'www.fda.gov', 'www.finlex.fi', 'www.gesetze-im-internet.de',
  'www.forschungsdatenzentrum-gesundheit.de', 'www.gov.uk', 'www.govinfo.gov', 'www.health-data-hub.fr', 'www.legislation.gov.au',
  'www.legislation.gov.uk', 'www.ontario.ca', 'www.pcpd.org.hk', 'www.tga.gov.au',
  'www3.ha.org.hk',
]);

function text(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value &&
    !/[\u0000-\u001F\u007F]/u.test(value);
}

function primaryURL(value) {
  if (!/^https:\/\//u.test(value) || /[\s\\]/u.test(value)) return false;
  const url = URL.parse(value);
  return url && primaryHosts.has(url.hostname) && !url.username && !url.password && !url.port;
}

export function validateGateways(rows, { reservedTerms = [] } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('atlas must contain gateway rows');
  const ids = new Set();
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('invalid gateway row');
    for (const [field, type] of Object.entries(fieldTypes)) {
      const value = row[field];
      if (field === 'official_source_urls' && (!Array.isArray(value) || value.length === 0)) {
        throw new Error('primary sources required');
      }
      const ok = type === 'list' ? Array.isArray(value) && value.length > 0 && value.every(text) &&
        new Set(value).size === value.length : type === 'boolean' ? typeof value === type : text(value);
      if (!ok) throw new Error(`${field} must be valid ${type}`);
    }
    if (Object.keys(row).length !== fields.length) throw new Error('unexpected gateway fields');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(row.gateway_id)) throw new Error('invalid gateway id');
    if (ids.has(row.gateway_id)) throw new Error('duplicate gateway id');
    ids.add(row.gateway_id);
    if (!routeTypes.has(row.route_type)) throw new Error('invalid route_type');
    if (!row.official_source_urls.every(primaryURL)) throw new Error('invalid primary source URL');
    if (!canonical.has(row.presencis_canonical_url)) throw new Error('invalid public reference URL');
    const rowText = JSON.stringify(row).toLowerCase();
    if (reservedTerms.some(term => rowText.includes(term.toLowerCase()))) throw new Error('reserved term');
  }
  return rows;
}

function csvCell(value) {
  const content = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return '"' + content.replaceAll('"', '""') + '"';
}

function markdown(rows) {
  return [
    '# Global Health Data Access & Secondary-Use AI Gateway Atlas',
    '',
    'Research-access routes describe ways to request data. Device-evidence and privacy-rule entries describe separate steps.',
    'Flags describe the named route and its scope. Check the cited rules for the specific data and purpose.',
    '',
    ...rows.flatMap(row => [
      `## ${row.jurisdiction} · ${row.authority_name}`, '',
      `- Route type: ${row.route_type}`,
      `- Legal basis: ${row.legal_basis}`,
      `- AI and secondary use: ${row.ai_secondary_use_scope}`,
      `- Secure processing or data environment required: ${row.spe_or_sde_required ? 'Yes' : 'No'}`,
      `- Evidence: ${row.required_application_evidence.join(' · ')}`,
      `- Subgroup or bias evidence expected: ${row.subgroup_or_bias_evidence_expected ? 'Yes' : 'No'}`,
      `- Disclosure controls expected: ${row.disclosure_control_expected ? 'Yes' : 'No'}`,
      `- Dates and timing: ${row.key_milestones_or_timelines}`,
      ...row.official_source_urls.map((url, index) => `- [Official source ${index + 1}](${url})`),
      `- [Presencis regulation reference](${row.presencis_canonical_url})`, '',
    ]),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = new URL('../data/gateways.json', import.meta.url);
  const rows = validateGateways(JSON.parse(readFileSync(source, 'utf8')));
  const csv = [fields.join(','), ...rows.map(row => fields.map(field => csvCell(row[field])).join(','))];
  writeFileSync(new URL('../data/gateways.csv', import.meta.url), csv.join('\n') + '\n');
  writeFileSync(new URL('../ATLAS.md', import.meta.url), markdown(rows));
}
