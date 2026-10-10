import { test, expect } from '@playwright/test';
import { BN } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
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
    action: { authority, status: { finalized: {} }, recordSlot: bn(99), recordTimestamp: bn(1000), snapshotTimestamp: bn(1001), updatedSlot: bn(110), updatedAt: bn(1002),
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
  first.calculated = false; first.settled = false;
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
