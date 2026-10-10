import type { PublicKey } from "@solana/web3.js";
import type { ProtocolReport } from "./protocol";

const integer = (value: { toString(): string }) => BigInt(value.toString());
const bytes = (value: bigint, length = 8) => {
  const result = new Uint8Array(length);
  for (let index = 0; index < length; index++) result[index] = Number((BigInt.asUintN(length * 8, value) >> BigInt(index * 8)) & 255n);
  return result;
};
async function hash(...parts: Uint8Array[]) {
  const input = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { input.set(part, offset); offset += part.length; }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}
const matches = (left: Uint8Array, right: number[]) => left.length === right.length && left.every((byte, index) => byte === right[index]);
const unsigned = (value: { toString(): string }, bits = 64) => integer(value) >= 0n && integer(value) < (1n << BigInt(bits));

// Independent read-only verification; never used to authorize an instruction.
export async function auditProtocol(actionAddress: PublicKey, report: ProtocolReport) {
  const { action, instrument, rights, receipt } = report;
  const issues: string[] = [];
  const check = (condition: boolean, message: string) => { if (!condition) issues.push(message); };
  const status = Object.keys(action.status)[0];
  const stages = ["scheduled", "snapshotPending", "snapshotted", "calculated", "awaitingApproval", "approved", "funded", "executing", "settled", "finalized", "cancelled"];
  check(Object.keys(action.status).length === 1 && stages.includes(status), "Unknown action status");
  const completeSnapshot = !["scheduled", "snapshotPending", "cancelled"].includes(status);
  const completeCalculation = ["calculated", "awaitingApproval", "approved", "funded", "executing", "settled", "finalized"].includes(status);
  const completeSettlement = ["settled", "finalized"].includes(status);
  check(action.authority.equals(instrument.authority), "Action authority mismatch");
  const validTerms = unsigned(instrument.faceValueMinor) && integer(instrument.faceValueMinor) > 0n
    && Number.isInteger(instrument.couponBps) && instrument.couponBps >= 0 && instrument.couponBps <= 10_000
    && Number.isInteger(instrument.paymentsPerYear) && instrument.paymentsPerYear > 0 && instrument.paymentsPerYear <= 65535;
  check(validTerms, "Invalid instrument financial parameters");
  check([action.recordSlot, action.updatedSlot, action.snapshotUnits, action.expectedSupply, action.totalObligationMinor, action.settledTotalMinor, instrument.outstandingSupply].every(value => unsigned(value))
    && [action.snapshotHolders, action.expectedHolders, action.calculatedHolders, action.processedHolders].every(value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff), "Invalid action integer range");
  if (["approved", "funded", "executing", "settled", "finalized"].includes(status)) {
    check(action.approvedBy.equals(action.authority), "Missing authorized approval");
  }
  if (status === "snapshotPending" || completeSnapshot) {
    check(integer(action.recordSlot) > 0n, "Missing snapshot record slot");
    check(integer(action.snapshotTimestamp) >= integer(action.recordTimestamp), "Snapshot predates record date");
  }
  let calculatedTotal = 0n, settledTotal = 0n, snapshotTotal = 0n;
  let calculatedCount = 0, settledCount = 0;
  const holders = new Set<string>();
  for (const { account: right } of rights) {
    const holder = right.holder.toBase58();
    check(!holders.has(holder), `Duplicate snapshot holder: ${holder}`); holders.add(holder);
    check(right.action.equals(actionAddress), `Wrong action for holder: ${holder}`);
    check([right.snapshotUnits, right.amountMinor, right.principalMinor, right.finalCouponMinor, right.votingPower, right.settledSlot, right.settledAmountMinor].every(value => unsigned(value)), `Invalid entitlement integer range: ${holder}`);
    snapshotTotal += integer(right.snapshotUnits);
    if (right.calculated) {
      calculatedCount++;
      const numerator = validTerms ? integer(right.snapshotUnits) * integer(instrument.faceValueMinor) * BigInt(instrument.couponBps) : -1n;
      const denominator = validTerms ? 10_000n * BigInt(instrument.paymentsPerYear) : 0n;
      check(denominator > 0n && integer(right.amountMinor) === (denominator > 0n ? numerator / denominator : -1n), `Coupon formula mismatch: ${holder}`);
      check(integer(right.principalMinor) === integer(right.snapshotUnits) * integer(instrument.faceValueMinor), `Principal contract mismatch: ${holder}`);
      check(integer(right.finalCouponMinor) === integer(right.amountMinor), `Final coupon contract mismatch: ${holder}`);
      check(integer(right.votingPower) === integer(right.snapshotUnits), `Voting power contract mismatch: ${holder}`);
      calculatedTotal += integer(right.amountMinor);
    }
    if (right.settled) {
      settledCount++;
      check(right.calculated && integer(right.settledAmountMinor) === integer(right.amountMinor), `Payment amount mismatch: ${holder}`);
      check(integer(right.settledSlot) > 0n && right.destination.toBytes().some(byte => byte !== 0), `Missing payment reference: ${holder}`);
      settledTotal += integer(right.settledAmountMinor);
    } else {
      check(integer(right.settledSlot) === 0n && integer(right.settledAmountMinor) === 0n && !right.destination.toBytes().some(byte => byte !== 0), `Unsettled right has payment reference: ${holder}`);
    }
  }
  check(rights.length === action.snapshotHolders && snapshotTotal === integer(action.snapshotUnits), "Snapshot aggregate mismatch");
  check(calculatedCount === action.calculatedHolders && calculatedTotal === integer(action.totalObligationMinor), "Calculated aggregate mismatch");
  check(settledCount === action.processedHolders && settledTotal === integer(action.settledTotalMinor), "Settlement aggregate mismatch");
  check(report.mintSupply === integer(instrument.outstandingSupply), "Outstanding supply mismatch");
  if (completeSnapshot) check(rights.length === action.expectedHolders && snapshotTotal === integer(action.expectedSupply), "Incomplete finalized snapshot");
  if (completeCalculation) check(calculatedCount === action.expectedHolders, "Incomplete calculated action");
  if (completeSettlement) check(settledCount === action.expectedHolders && settledTotal === calculatedTotal, "Incomplete settled action");
  if (["scheduled", "cancelled"].includes(status)) check(rights.length === 0 && integer(action.recordSlot) === 0n, "Unexpected snapshot before capture");
  if (["scheduled", "snapshotPending", "cancelled"].includes(status)) check(calculatedCount === 0, "Calculation before snapshot finalization");
  if (!["executing", "settled", "finalized"].includes(status)) check(settledCount === 0, "Settlement before execution");
  if (status === "executing") check(settledCount > 0 && settledCount < action.expectedHolders, "Invalid partial settlement progress");
  let snapshotHashVerified = false;
  if (integer(action.recordSlot) > 0n) {
    let commitment = await hash(actionAddress.toBytes(), bytes(integer(action.recordSlot)), bytes(integer(action.recordTimestamp)));
    const ordered = [...rights].sort((a, b) => a.account.snapshotIndex - b.account.snapshotIndex);
    for (const [index, { account: right }] of ordered.entries()) {
      check(right.snapshotIndex === index + 1, "Snapshot ordering mismatch");
      commitment = await hash(commitment, right.holder.toBytes(), bytes(integer(right.snapshotUnits)));
    }
    snapshotHashVerified = matches(commitment, action.snapshotHash);
    check(snapshotHashVerified, "Snapshot hash mismatch");
  }
  let receiptHashVerified = false;
  if (receipt) {
    check(status === "finalized" && Object.keys(receipt.finalStatus).length === 1 && "finalized" in receipt.finalStatus && receipt.action.equals(actionAddress), "Receipt identity/status mismatch");
    check(unsigned(receipt.finalizedSlot) && unsigned(receipt.settledTotalMinor) && Number.isInteger(receipt.processedHolders) && receipt.processedHolders >= 0 && receipt.processedHolders <= 0xffffffff, "Invalid receipt integer range");
    check(receipt.processedHolders === action.expectedHolders && settledCount === action.expectedHolders && settledTotal === calculatedTotal && integer(receipt.settledTotalMinor) === settledTotal, "Receipt totals mismatch");
    check(integer(receipt.finalizedSlot) === integer(action.updatedSlot) && integer(receipt.finalizedAt) === integer(action.updatedAt)
      && integer(receipt.finalizedSlot) >= integer(action.recordSlot) && integer(receipt.finalizedAt) >= integer(action.snapshotTimestamp), "Receipt finalization reference mismatch");
    check(rights.every(({ account: right }) => integer(right.settledSlot) >= integer(action.recordSlot) && integer(right.settledSlot) <= integer(receipt.finalizedSlot)), "Payment outside action slot range");
    const commitment = await hash(actionAddress.toBytes(), Uint8Array.from(action.snapshotHash), bytes(integer(receipt.settledTotalMinor)), bytes(BigInt(receipt.processedHolders), 4), bytes(integer(receipt.finalizedSlot)));
    receiptHashVerified = matches(commitment, receipt.summaryHash);
    check(receiptHashVerified, "Receipt hash mismatch");
  } else check(status !== "finalized", "Finalized action has no receipt");
  return { issues, calculatedTotal, settledTotal, snapshotHashVerified, receiptHashVerified };
}
export type ProtocolAudit = Awaited<ReturnType<typeof auditProtocol>>;
