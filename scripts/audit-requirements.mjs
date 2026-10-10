import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(readFileSync('docs/audit-coverage.json', 'utf8'));
const requirements = readFileSync('docs/REQUIREMENTS.md', 'utf8');
const roadmap = readFileSync('docs/ROADMAP.md', 'utf8');
const normative = new Set([...requirements.matchAll(/^(?:- (?:\*\*)?((?:FR|NFR|TC)-\d+)|### (UC-[A-Z]+-\d+))/gm)].map(match => match[1] || match[2]));
const mapped = new Map();
function expand(value) {
  const match = /^(FR|NFR|TC)-(\d+)\.\.(\d+)$/.exec(value);
  if (!match) return [value];
  const [, kind, first, last] = match;
  if (+last < +first) throw new Error(`Invalid requirement range ${value}`);
  return Array.from({ length: +last - +first + 1 }, (_, offset) => `${kind}-${String(+first + offset).padStart(2, '0')}`);
}
for (const row of manifest.coverage) {
  if (!['implemented', 'partial', 'planned', 'post-mvp'].includes(row.status)) throw new Error(`Invalid status ${row.status}`);
  if (!row.note || !roadmap.includes(row.roadmap)) throw new Error(`Missing limitation or roadmap reference ${row.roadmap}`);
  if (['implemented', 'partial'].includes(row.status) && !row.tests.length) throw new Error(`Missing evidence mapping ${row.ids}`);
  for (const file of row.tests) if (!existsSync(file)) throw new Error(`Missing evidence source ${file}`);
  for (const id of row.ids.flatMap(expand)) {
    if (!normative.has(id)) throw new Error(`Unknown normative requirement ${id}`);
    if (mapped.has(id)) throw new Error(`Duplicate requirement mapping ${id}`);
    mapped.set(id, row);
  }
}
const missing = [...normative].filter(id => !mapped.has(id));
if (missing.length) throw new Error(`Unmapped normative requirements: ${missing.join(', ')}`);
// Scan tracked executable/source/config files without printing matched secret material.
// This detects common embedded private-key forms, not arbitrary secrets or git history.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const suspicious = tracked.filter(file => existsSync(file) && /\.(?:[cm]?[jt]sx?|rs|json|ya?ml|env|html)$/.test(file)).filter(file => {
  const source = readFileSync(file, 'utf8');
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)
    || /(?:secretKey|private_key|privateKey)\s*[:=]\s*\[\s*\d+(?:\s*,\s*\d+){31}/.test(source);
});
if (suspicious.length) throw new Error(`Potential embedded private key; inspect files without logging secrets: ${suspicious.join(', ')}`);
const report = { generatedAt: new Date().toISOString(), boundary: 'Static traceability and common embedded-key pattern check; does not execute or prove acceptance tests.',
  sourceHashes: Object.fromEntries(manifest.source.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])),
  requirements: [...mapped].map(([id, row]) => ({ id, status: row.status, roadmap: row.roadmap, tests: row.tests, limitation: row.note })) };
mkdirSync('target/security-audit', { recursive: true });
writeFileSync('target/security-audit/traceability.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Mapped ${mapped.size}/${normative.size} normative IDs; source/evidence paths valid; common embedded-key patterns absent.`);
for (const status of ['implemented', 'partial', 'planned', 'post-mvp']) console.log(`${status}: ${report.requirements.filter(row => row.status === status).length}`);
