import { test, expect } from '@playwright/test';
import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { auditProtocol } from '../src/shared/solana/protocol-audit';
import type { ProtocolReport } from '../src/shared/solana/protocol';
const fixture = JSON.parse(readFileSync('golden/coupon-tz-section-22.json', 'utf8'));
const bn = (n: number | bigint) => new BN(n.toString());
const le = (n: number | bigint, size = 8) => bn(n).toArrayLike(Buffer, 'le', size);
const hash = (...parts: Uint8Array[]) => createHash('sha256').update(Buffer.concat(parts)).digest();

function goldenReport() {
  const address = Keypair.generate().publicKey;
  const authority = Keypair.generate().publicKey;
  const rights = Object.entries(fixture.input.snapshot as Record<string, number>).map(([name, units], index) => ({
    publicKey: Keypair.generate().publicKey,
    account: { action: address, holder: Keypair.generate().publicKey, snapshotUnits: bn(units), snapshotIndex: index + 1,
      amountMinor: bn(fixture.expected.amountsMinor[name]), principalMinor: bn(units * fixture.input.terms.faceValueMinor),
      finalCouponMinor: bn(fixture.expected.amountsMinor[name]), votingPower: bn(units), calculated: true, settled: true,
      settledSlot: bn(100 + index), destination: Keypair.generate().publicKey, settledAmountMinor: bn(fixture.expected.amountsMinor[name]) }
  }));
  let snapshotHash = hash(address.toBuffer(), le(99), le(1000));
  for (const { account: right } of rights) snapshotHash = hash(snapshotHash, right.holder.toBuffer(), le(BigInt(right.snapshotUnits.toString())));
  const report = {
    action: { authority, approvedBy: authority, status: { finalized: {} }, recordSlot: bn(99), recordTimestamp: bn(1000), snapshotTimestamp: bn(1001), updatedSlot: bn(110), updatedAt: bn(1002),
      snapshotHash: [...snapshotHash], snapshotHolders: 4, snapshotUnits: bn(17), expectedHolders: 4, expectedSupply: bn(17),
      calculatedHolders: 4, processedHolders: 4, totalObligationMinor: bn(85000), settledTotalMinor: bn(85000) },
    instrument: { authority, faceValueMinor: bn(100000), couponBps: 1000, paymentsPerYear: 2, outstandingSupply: bn(17) },
    rights, mintSupply: 17n,
    receipt: { action: address, finalStatus: { finalized: {} }, settledTotalMinor: bn(85000), processedHolders: 4,
      finalizedSlot: bn(110), finalizedAt: bn(1002), summaryHash: [...hash(address.toBuffer(), snapshotHash, le(85000), le(4, 4), le(110))] }
  } as unknown as ProtocolReport;
  return { address, report };
}

test('M1.5: independent TZ golden verifier accepts exact formula, commitment and receipt', async () => {
  const { address, report } = goldenReport();
  const audit = await auditProtocol(address, report);
  expect(audit.issues).toEqual([]);
  expect(audit.calculatedTotal).toBe(BigInt(fixture.expected.totalMinor));
  expect(audit.settledTotal).toBe(BigInt(fixture.expected.totalMinor));
  expect(audit.snapshotHashVerified).toBe(true);
  expect(audit.receiptHashVerified).toBe(true);
});

test('M1.5: internally consistent forged amounts still fail the independent formula', async () => {
  const { address, report } = goldenReport();
  const first = report.rights[0].account;
  first.amountMinor = bn(51000); first.finalCouponMinor = bn(51000); first.settledAmountMinor = bn(51000);
  report.action.totalObligationMinor = bn(86000); report.action.settledTotalMinor = bn(86000);
  report.receipt!.settledTotalMinor = bn(86000);
  report.receipt!.summaryHash = [...hash(address.toBuffer(), Uint8Array.from(report.action.snapshotHash), le(86000), le(4, 4), le(110))];
  const audit = await auditProtocol(address, report);
  expect(audit.receiptHashVerified).toBe(true);
  expect(audit.issues).toEqual([expect.stringContaining('Coupon formula mismatch')]);
});

test('M1.5: reordered snapshots, wrong payouts and corrupted receipts are rejected', async () => {
  const { address, report } = goldenReport();
  report.rights[0].account.snapshotIndex = 2;
  report.rights[1].account.snapshotIndex = 1;
  report.rights[0].account.settledAmountMinor = bn(1);
  report.receipt!.summaryHash[0] ^= 1;
  const audit = await auditProtocol(address, report);
  expect(audit.issues).toContain('Snapshot hash mismatch');
  expect(audit.issues).toContain('Settlement aggregate mismatch');
  expect(audit.issues).toContain('Receipt hash mismatch');
  expect(audit.snapshotHashVerified).toBe(false);
  expect(audit.receiptHashVerified).toBe(false);
});

test('NFR-05/06: a finalized report cannot skip capture or forge finalization references', async () => {
  const cases: Array<[string, (report: ProtocolReport) => void]> = [
    ['Missing snapshot record slot', report => { report.action.recordSlot = bn(0); }],
    ['Snapshot predates record date', report => { report.action.snapshotTimestamp = bn(999); }],
    ['Receipt finalization reference mismatch', report => { report.receipt!.finalizedAt = bn(1003); }],
    ['Receipt finalization reference mismatch', report => { report.action.updatedSlot = bn(111); }],
    ['Payment outside action slot range', report => { report.rights[0].account.settledSlot = bn(111); }],
    ['Action authority mismatch', report => { report.action.authority = Keypair.generate().publicKey; }],
    ['Invalid instrument financial parameters', report => { report.instrument.couponBps = 10001; }]
  ];
  for (const [issue, mutate] of cases) {
    const { address, report } = goldenReport();
    mutate(report);
    expect((await auditProtocol(address, report)).issues).toContain(issue);
  }
});

test('NFR-05: internally reconciled counts still require lifecycle completion', async () => {
  const { address, report } = goldenReport();
  const first = report.rights[0].account;
  first.calculated = false; first.settled = false; first.settledSlot = bn(0); first.settledAmountMinor = bn(0); first.destination = PublicKey.default;
  report.action.calculatedHolders = 3; report.action.processedHolders = 3;
  report.action.totalObligationMinor = bn(35000); report.action.settledTotalMinor = bn(35000);
  const issues = (await auditProtocol(address, report)).issues;
  expect(issues).not.toContain('Calculated aggregate mismatch');
  expect(issues).not.toContain('Settlement aggregate mismatch');
  expect(issues).toContain('Incomplete calculated action');
  expect(issues).toContain('Incomplete settled action');
});

test('NFR-05: amounts and hashes cannot disguise payment before execution', async () => {
  const { address, report } = goldenReport();
  report.action.status = { funded: {} };
  report.receipt = null;
  expect((await auditProtocol(address, report)).issues).toContain('Settlement before execution');
});

const attacks: Array<[string, (report: ProtocolReport) => void, string]> = [
  ['approval identity', report => { report.action.approvedBy = PublicKey.default; }, 'Missing authorized approval'],
  ['duplicate holder', report => { report.rights[1].account.holder = report.rights[0].account.holder; }, 'Duplicate snapshot holder'],
  ['cross-action right', report => { report.rights[0].account.action = Keypair.generate().publicKey; }, 'Wrong action for holder'],
  ['missing receipt', report => { report.receipt = null; }, 'Finalized action has no receipt'],
  ['cross-action receipt', report => { report.receipt!.action = Keypair.generate().publicKey; }, 'Receipt identity/status mismatch'],
  ['receipt status', report => { report.receipt!.finalStatus = { settled: {} }; }, 'Receipt identity/status mismatch'],
  ['supply', report => { report.mintSupply = 18n; }, 'Outstanding supply mismatch'],
  ['principal', report => { report.rights[0].account.principalMinor = bn(1); }, 'Principal contract mismatch'],
  ['final coupon', report => { report.rights[0].account.finalCouponMinor = bn(1); }, 'Final coupon contract mismatch'],
  ['voting power', report => { report.rights[0].account.votingPower = bn(1); }, 'Voting power contract mismatch'],
  ['missing destination', report => { report.rights[0].account.destination = PublicKey.default; }, 'Missing payment reference'],
  ['payment before capture', report => { report.rights[0].account.settledSlot = bn(98); }, 'Payment outside action slot range'],
  ['negative amount', report => { report.rights[0].account.amountMinor = bn(-1); }, 'Invalid entitlement integer range'],
  ['wrapped slot', report => { report.action.recordSlot = bn((1n << 64n) + 99n); }, 'Invalid action integer range'],
  ['negative coupon bps', report => { report.instrument.couponBps = -1; }, 'Invalid instrument financial parameters'],
  ['fractional frequency', report => { report.instrument.paymentsPerYear = 1.5; }, 'Invalid instrument financial parameters'],
  ['unknown lifecycle', report => { report.action.status = { draft: {} }; }, 'Unknown action status']
];
for (const [attack, mutate, issue] of attacks) {
  test(`FR-42 NFR-05/06/11 forged audit: ${attack}`, async () => {
    const { address, report } = goldenReport();
    mutate(report);
    expect((await auditProtocol(address, report)).issues.some(message => message.includes(issue))).toBe(true);
  });
}

test('NFR-08 valid partial settlement can be audited and resumed', async () => {
  const { address, report } = goldenReport();
  report.action.status = { executing: {} }; report.receipt = null;
  for (const { account: right } of report.rights.slice(1)) {
    right.settled = false; right.settledSlot = bn(0); right.settledAmountMinor = bn(0); right.destination = PublicKey.default;
  }
  report.action.processedHolders = 1; report.action.settledTotalMinor = bn(50000);
  expect((await auditProtocol(address, report)).issues).toEqual([]);
  report.rights[1].account.settledAmountMinor = bn(25000);
  expect((await auditProtocol(address, report)).issues).toContainEqual(expect.stringContaining('Unsettled right has payment reference'));
});
