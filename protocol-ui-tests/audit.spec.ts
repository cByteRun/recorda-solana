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
    action: { status: { finalized: {} }, recordSlot: bn(99), recordTimestamp: bn(1000), snapshotTimestamp: bn(1001),
      snapshotHash: [...snapshotHash], snapshotHolders: 4, snapshotUnits: bn(17), expectedHolders: 4, expectedSupply: bn(17),
      calculatedHolders: 4, processedHolders: 4, totalObligationMinor: bn(85000), settledTotalMinor: bn(85000) },
    instrument: { faceValueMinor: bn(100000), couponBps: 1000, paymentsPerYear: 2, outstandingSupply: bn(17) },
    rights, mintSupply: 17n,
    receipt: { action: address, finalStatus: { finalized: {} }, settledTotalMinor: bn(85000), processedHolders: 4,
      finalizedSlot: bn(110), summaryHash: [...hash(address.toBuffer(), snapshotHash, le(85000), le(4, 4), le(110))] }
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
