import { expect, test } from "@playwright/test";
import { Buffer } from "buffer";
import { ComputeBudgetProgram, Connection, Keypair, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@/shared/solana/config";
import { phantomSignAndSend, transactionFromInstructions } from "@/shared/solana/transactions";
import type { PhantomProvider } from "@/shared/solana/phantom";

const operator = Keypair.generate();
const blockhash = Keypair.generate().publicKey.toBase58();
const memo = new TransactionInstruction({
  programId: MEMO_PROGRAM_ID,
  keys: [{ pubkey: operator.publicKey, isSigner: true, isWritable: false }],
  data: Buffer.from(JSON.stringify({ type: "KASE_RECORD_DATE_SNAPSHOT", holders: "x".repeat(550) }))
});

function harness() {
  const calls = { sign: 0, send: 0, simulate: 0 };
  const rpc = new Connection("https://api.devnet.solana.com");
  rpc.getLatestBlockhashAndContext = async () => ({ context: { slot: 10 }, value: { blockhash, lastValidBlockHeight: 100 } });
  rpc.getBlockHeight = async () => 50;
  rpc.simulateTransaction = (async () => {
    calls.simulate += 1;
    return { context: { slot: 10 }, value: { err: null, logs: [] } };
  }) as Connection["simulateTransaction"];
  rpc.sendRawTransaction = async () => { calls.send += 1; return "submitted-signature"; };
  rpc.confirmTransaction = (async () => ({ context: { slot: 10 }, value: { err: null } })) as Connection["confirmTransaction"];
  const provider: PhantomProvider = {
    publicKey: operator.publicKey,
    connect: async () => ({ publicKey: operator.publicKey }),
    signTransaction: async (tx: Transaction | VersionedTransaction) => {
      calls.sign += 1;
      expect(tx).toBeInstanceOf(VersionedTransaction);
      const versioned = tx as VersionedTransaction;
      expect(versioned.version).toBe(0);
      VersionedTransaction.deserialize(versioned.serialize());
      versioned.sign([operator]);
      return versioned;
    }
  };
  const send = () => phantomSignAndSend({ provider, operator: operator.publicKey, instructions: [memo], rpc, label: "snapshot" });
  return { calls, rpc, provider, send };
}

test("signed JSON Memo receives an explicit compute budget without losing payload", () => {
  const tx = transactionFromInstructions([memo]);
  expect(tx.instructions[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true);
  expect(tx.instructions[0].data.readUInt32LE(1)).toBe(600_000);
  expect(tx.instructions[1]).toBe(memo);
  const budget = ComputeBudgetProgram.setComputeUnitLimit({ units: 700_000 });
  expect(transactionFromInstructions([budget, memo]).instructions).toEqual([budget, memo]);
  const price = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 });
  expect(transactionFromInstructions([price, memo]).instructions).toHaveLength(3);
});

test("RPC simulation failure exposes program logs without opening Phantom or submitting", async () => {
  const h = harness();
  h.rpc.simulateTransaction = (async () => ({ context: { slot: 10 }, value: {
    err: { InstructionError: [1, "ComputationalBudgetExceeded"] }, logs: ["Program failed: compute budget exceeded"]
  } })) as Connection["simulateTransaction"];
  await expect(h.send()).rejects.toThrow("compute budget exceeded");
  expect(h.calls.sign).toBe(0);
  expect(h.calls.send).toBe(0);
});

test("Phantom unexpected error gives Devnet recovery guidance without retries", async () => {
  const h = harness();
  h.provider.signTransaction = async () => { h.calls.sign += 1; throw { code: -32603, message: "Unexpected error" }; };
  await expect(h.send()).rejects.toThrow("Set Phantom to Solana Devnet");
  expect(h.calls.sign).toBe(1);
  expect(h.calls.send).toBe(0);
});

test("confirmation expiry after broadcast never signs or pays again", async () => {
  const h = harness();
  h.rpc.confirmTransaction = (async () => { throw new Error("TransactionExpiredBlockheightExceeded"); }) as Connection["confirmTransaction"];
  await expect(h.send()).rejects.toThrow("submitted-signature was submitted");
  expect(h.calls.sign).toBe(1);
  expect(h.calls.send).toBe(1);
});

test("successful simulation still requires operator signing before broadcast", async () => {
  const h = harness();
  await expect(h.send()).resolves.toBe("submitted-signature");
  expect(h.calls).toEqual({ simulate: 1, sign: 1, send: 1 });
});

test("changed Phantom account is rejected before simulation or signing", async () => {
  const h = harness();
  h.provider.publicKey = Keypair.generate().publicKey;
  await expect(h.send()).rejects.toThrow("Phantom account changed");
  expect(h.calls).toEqual({ simulate: 0, sign: 0, send: 0 });
});

 test("v0 signing preserves a holder partial signature across the wallet boundary", async () => {
  const h = harness();
  const holder = Keypair.generate();
  const instruction = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [operator, holder].map((key) => ({ pubkey: key.publicKey, isSigner: true, isWritable: false })),
    data: Buffer.from("holder attestation")
  });
  h.provider.signTransaction = async (tx) => {
    const v0 = tx as VersionedTransaction;
    const before = Uint8Array.from(v0.signatures[1]);
    expect(before.some((byte) => byte !== 0)).toBe(true);
    v0.sign([operator]);
    expect(v0.signatures[1]).toEqual(before);
    return v0;
  };
  await expect(phantomSignAndSend({ provider: h.provider, operator: operator.publicKey,
    instructions: [instruction], partialSigners: [holder], rpc: h.rpc })).resolves.toBe("submitted-signature");
});

test('R1 NFR-03/08: broadcast signature is retained before ambiguous confirmation', async () => {
  const h = harness();
  let persisted: string | null = null;
  h.rpc.confirmTransaction = (async () => {
    expect(persisted).toBe('submitted-signature');
    throw new Error('Confirmation unavailable');
  }) as Connection['confirmTransaction'];
  await expect(phantomSignAndSend({ provider: h.provider, operator: operator.publicKey,
    instructions: [memo], rpc: h.rpc, onSubmitted: signature => { persisted = signature; }
  })).rejects.toThrow('was submitted');
  expect(persisted).toBe('submitted-signature');
  expect(h.calls.send).toBe(1);
});
