import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateGateways } from '../scripts/build-atlas.mjs';

const gateway = {
  gateway_id: 'example-gateway',
  jurisdiction: 'Example jurisdiction',
  authority_name: 'Example authority',
  route_type: 'research-access',
  legal_basis: 'Example law',
  ai_secondary_use_scope: 'Research under a permit',
  spe_or_sde_required: true,
  required_application_evidence: ['Research plan'],
  subgroup_or_bias_evidence_expected: false,
  disclosure_control_expected: true,
  key_milestones_or_timelines: 'Example timeline',
  official_source_urls: ['https://health.ec.europa.eu/example'],
  presencis_canonical_url: 'https://presencis.com/regulations/',
};

test('rejects missing primary sources', () => {
  assert.throws(() => validateGateways([{ ...gateway, official_source_urls: [] }]), /primary sources/);
});

test('rejects links outside verified government hosts and malformed HTTPS links', () => {
  for (const url of [
    'https://example.org/path',
    'http://health.ec.europa.eu/path',
    'https://health.ec.europa.eu@elsewhere.example/path',
    'https://health.ec.europa.eu/a b',
  ]) {
    assert.throws(() => validateGateways([{ ...gateway, official_source_urls: [url] }]), /primary source/);
  }
});

test('rejects terms reserved for non-public use', () => {
  const reserved = 'restricted term';
  assert.throws(() => validateGateways([{ ...gateway, legal_basis: reserved }], { reservedTerms: [reserved] }), /reserved term/);
});

test('rejects ambiguous identity, wrong types, and missing fields', () => {
  assert.throws(() => validateGateways([gateway, gateway]), /duplicate gateway id/);
  assert.throws(() => validateGateways([{ ...gateway, spe_or_sde_required: 'true' }]), /boolean/);
  assert.throws(() => validateGateways([{ ...gateway, legal_basis: undefined }]), /legal_basis/);
  assert.throws(() => validateGateways([{ ...gateway, route_type: 'unknown' }]), /route_type/);
});

test('atlas covers every named route', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/gateways.json', import.meta.url), 'utf8'));
  assert.equal(validateGateways(rows), rows);
  assert.deepEqual(rows.map(row => row.gateway_id).sort(), [
    'au-tga', 'ca-health-canada', 'de-fdz', 'eu-ehds', 'fi-findata', 'fr-snds',
    'hk-hadcl', 'uk-mhra', 'uk-nhs-sde', 'us-fda', 'us-hipaa',
  ]);
  const markdown = readFileSync(new URL('../ATLAS.md', import.meta.url), 'utf8');
  for (const row of rows) {
    assert.ok(markdown.includes(row.authority_name), row.gateway_id);
    for (const source of row.official_source_urls) assert.ok(markdown.includes(source), source);
  }
});
