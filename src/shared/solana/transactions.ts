import {
  ComputeBudgetProgram,
  Transaction,
  VersionedTransaction,
  type Connection,
  type Keypair,
  type PublicKey,
  type TransactionInstruction
} from "@solana/web3.js";
import { connection, MEMO_PROGRAM_ID } from "@/shared/solana/config";
import type { PhantomProvider } from "@/shared/solana/phantom";

export function transactionFromInstructions(instructions: TransactionInstruction[]) {
  const tx = new Transaction();
  // Signed JSON Memo attestations can exceed the default per-instruction budget.
  // Keep the complete payload, including snapshot holders and receipt references.
  const hasMemo = instructions.some((instruction) => instruction.programId.equals(MEMO_PROGRAM_ID));
  const hasBudget = instructions.some((instruction) =>
    instruction.programId.equals(ComputeBudgetProgram.programId) && instruction.data[0] === 2
  );
  if (hasMemo && !hasBudget) {
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));
  }
  instructions.forEach((instruction) => tx.add(instruction));
  return tx;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export async function phantomSignAndSend({
  provider,
  operator,
  instructions,
  partialSigners = [],
  label = "transaction",
  maxBlockhashRetries = 2,
  rpc = connection
}: {
  provider: PhantomProvider;
  operator: PublicKey;
  instructions: TransactionInstruction[];
  partialSigners?: Keypair[];
  label?: string;
  maxBlockhashRetries?: number;
  rpc?: Connection;
}) {
  if (!provider.publicKey?.equals(operator)) {
    throw new Error("Phantom account changed or disconnected. Reconnect the operator wallet before signing.");
  }
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxBlockhashRetries; attempt += 1) {
    let broadcastSignature: string | null = null;
    const tx = transactionFromInstructions(instructions);
    const latest = await rpc.getLatestBlockhashAndContext("confirmed");
    tx.feePayer = operator;
    tx.recentBlockhash = latest.value.blockhash;
    partialSigners.forEach((signer) => tx.partialSign(signer));

    try {
      // Diagnose program/funding errors before Phantom hides simulation failures
      // behind "Unexpected error". Simulation does not sign or submit anything.
      const simulation = await rpc.simulateTransaction(new VersionedTransaction(tx.compileMessage()), {
        sigVerify: false,
        commitment: "confirmed",
        minContextSlot: latest.context.slot
      });
      if (simulation.value.err) {
        const logs = (simulation.value.logs ?? []).slice(-6).join("\n");
        throw new Error(`${label} simulation failed on Solana Devnet: ${JSON.stringify(simulation.value.err)}${logs ? `\n${logs}` : ""}`);
      }

      let signed: Transaction;
      try {
        signed = await provider.signTransaction(tx);
      } catch (error) {
        if (/unexpected error/i.test(errorMessage(error))) {
          throw new Error(
            "Phantom could not sign the Devnet transaction. Set Phantom to Solana Devnet, verify the connected account, unlock the wallet and reconnect. RPC simulation passed; no transaction was submitted.",
            { cause: error }
          );
        }
        throw error;
      }
      const height = await rpc.getBlockHeight("confirmed");
      if (height > latest.value.lastValidBlockHeight) {
        throw new Error("BLOCKHASH_EXPIRED_BEFORE_SEND");
      }

      broadcastSignature = await rpc.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
        minContextSlot: latest.context.slot
      });
      const confirmation = await rpc.confirmTransaction(
        {
          signature: broadcastSignature,
          blockhash: latest.value.blockhash,
          lastValidBlockHeight: latest.value.lastValidBlockHeight
        },
        "confirmed"
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed with error: ${JSON.stringify(confirmation.value.err)}`);
      }
      return broadcastSignature;
    } catch (error) {
      lastError = error;
      // Once broadcast, never rebuild/re-sign a payment automatically: its
      // confirmation can be ambiguous even when the transfer actually landed.
      if (broadcastSignature) {
        throw new Error(`${label}: ${errorMessage(error)}. Transaction ${broadcastSignature} was submitted. Check its Devnet Explorer status and balances before retrying.`, { cause: error });
      }
      const blockhashError = /Blockhash not found|BlockhashNotFound|block height exceeded|BLOCKHASH_EXPIRED_BEFORE_SEND|TransactionExpiredBlockheightExceeded/i.test(errorMessage(error));
      if (!blockhashError || attempt >= maxBlockhashRetries) {
        console.error(`${label} failed`, error);
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}
