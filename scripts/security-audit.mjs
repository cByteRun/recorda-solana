import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const clientOnly = process.argv.includes('--client');
const scripts = ['audit:requirements', 'build', 'test:devnet:setup', 'test:e2e:golden'];
if (!clientOnly) scripts.push('protocol:test:rust', 'protocol:build', 'protocol:idl:check', 'protocol:test:ui');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const inputs = [...['src', 'tests', 'protocol-tests', 'protocol-ui-tests', 'programs/recorda/src', 'scripts'].flatMap(files),
  'package.json', 'package-lock.json', 'Cargo.toml', 'Cargo.lock', 'programs/recorda/Cargo.toml',
  'docs/audit-coverage.json', 'playwright.config.ts', 'playwright.protocol.config.ts', 'vite.config.ts'];
const hashes = () => Object.fromEntries(inputs.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const report = { startedAt: new Date().toISOString(), scope: clientOnly ? 'controlled-client-only' : 'client-rust-local-validator', inputHashes: hashes(), checks: [], passed: false };
mkdirSync('target/security-audit', { recursive: true });
const resultPath = 'target/security-audit/run.json';
function persist() { writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n'); }
persist(); // A failed new audit never leaves an earlier success report current.
for (const script of scripts) {
  const startedAt = new Date().toISOString();
  const child = spawn('npm', ['run', script], { stdio: 'inherit', env: process.env });
  const code = await new Promise(resolve => {
    child.once('error', error => { console.error(error.message); resolve(1); });
    child.once('exit', code => resolve(code ?? 1));
  });
  report.checks.push({ script, startedAt, finishedAt: new Date().toISOString(), exitCode: code }); persist();
  if (code !== 0) { process.exitCode = code; break; }
}
report.passed = report.checks.length === scripts.length && report.checks.every(check => check.exitCode === 0);
report.finishedAt = new Date().toISOString();
report.hashes = hashes();
report.changedInputs = inputs.filter(file => report.inputHashes[file] !== report.hashes[file]);
if (report.changedInputs.length) {
  report.passed = false; process.exitCode = 1;
  console.error('Audit inputs changed during execution; rerun against stable sources:', report.changedInputs.join(', '));
}
if (!clientOnly && existsSync('target/deploy/recorda.so')) report.hashes['target/deploy/recorda.so'] = createHash('sha256').update(readFileSync('target/deploy/recorda.so')).digest('hex');
persist();
console.log(`Audit ${report.passed ? 'passed' : 'failed'} (${report.scope}); evidence: ${resultPath}`);
