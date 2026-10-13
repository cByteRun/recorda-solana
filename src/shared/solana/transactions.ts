import {
  ComputeBudgetProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type Keypair,
  type PublicKey
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { encode as base58Encode } from "@coral-xyz/anchor/dist/esm/utils/bytes/bs58.js";
import { connection } from "@/shared/solana/config";
import type { PhantomProvider } from "@/shared/solana/phantom";

export function transactionFromInstructions(instructions: TransactionInstruction[]) {
  const tx = new Transaction();
  // Pin budget and fee before simulation/co-signing. Phantom otherwise may add
  // priority-fee instructions while signing, changing the simulated message.
  const hasBudget = instructions.some((instruction) =>
    instruction.programId.equals(ComputeBudgetProgram.programId) && instruction.data[0] === 2
  );
  if (!hasBudget) {
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));
  }
  const hasPrice = instructions.some((instruction) =>
    instruction.programId.equals(ComputeBudgetProgram.programId) && instruction.data[0] === 3
  );
  if (!hasPrice) {
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }));
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
  onSubmitted,
  onProgress,
  minContextSlot = 0,
  rpc = connection
}: {
  provider: PhantomProvider;
  operator: PublicKey;
  instructions: TransactionInstruction[];
  partialSigners?: Keypair[];
  label?: string;
  maxBlockhashRetries?: number;
  onSubmitted?: (signature: string) => void;
  onProgress?: (stage: "simulating" | "wallet" | "submitted" | "confirmed") => void;
  minContextSlot?: number;
  rpc?: Connection;
}) {
  if (!provider.publicKey?.equals(operator)) {
    throw new Error("Phantom account changed or disconnected. Reconnect the operator wallet before signing.");
  }
  let lastError: unknown = null;
  const copyInstruction = (instruction: TransactionInstruction) => new TransactionInstruction({
    programId: instruction.programId,
    keys: instruction.keys.map(key => ({ ...key })),
    data: Buffer.from(instruction.data)
  });
  // Provider objects can alias compiled instruction data. Keep original intent
  // private so a safe pre-broadcast retry cannot inherit provider mutations.
  const requestedInstructions = instructions.map(copyInstruction);

  for (let attempt = 0; attempt <= maxBlockhashRetries; attempt += 1) {
    let broadcastSignature: string | null = null;
    let broadcastAttempted = false;
    let attemptedSignature: string | null = null;
    const tx = transactionFromInstructions(requestedInstructions.map(copyInstruction));
    const latest = await rpc.getLatestBlockhashAndContext("confirmed");
    const requiredContextSlot = Math.max(minContextSlot, latest.context.slot);
    tx.feePayer = operator;
    tx.recentBlockhash = latest.value.blockhash;
    // Use a canonical v0 wire transaction for both simulation and Phantom.
    // Avoid passing a legacy Transaction with null signature slots through the
    // extension's legacy serialization path.
    const walletTransaction = new VersionedTransaction(new TransactionMessage({
      payerKey: operator,
      recentBlockhash: latest.value.blockhash,
      instructions: tx.instructions
    }).compileToV0Message());
    if (partialSigners.length) walletTransaction.sign(partialSigners);
    // Capture before calling the provider: it may mutate the same object.
    const expectedMessage = Uint8Array.from(walletTransaction.message.serialize());
    const expectedSignatures = walletTransaction.signatures.map(signature => Uint8Array.from(signature));
    walletTransaction.serialize(); // Fail locally on oversized/invalid wire data.

    try {
      // Diagnose program/funding errors before Phantom hides simulation failures
      // behind "Unexpected error". Simulation does not sign or submit anything.
      onProgress?.("simulating");
      const simulation = await rpc.simulateTransaction(walletTransaction, {
        sigVerify: false,
        commitment: "confirmed",
        minContextSlot: requiredContextSlot
      });
      if (simulation.value.err) {
        const logs = (simulation.value.logs ?? []).slice(-6).join("\n");
        throw new Error(`${label} simulation failed on Solana: ${JSON.stringify(simulation.value.err)}${logs ? `\n${logs}` : ""}`);
      }

      let signed: Transaction | VersionedTransaction;
      try {
        // Simulation/RPC waits can outlive a wallet account change.
        if (!provider.publicKey?.equals(operator)) {
          throw new Error("Phantom account changed or disconnected. Reconnect the operator wallet before signing.");
        }
        onProgress?.("wallet");
        signed = await provider.signTransaction(walletTransaction);
      } catch (error) {
        if (/unexpected error/i.test(errorMessage(error))) {
          throw new Error(
            "Phantom could not sign the transaction. Verify the selected RPC and connected account, unlock the wallet and reconnect. RPC simulation passed; no transaction was submitted.",
            { cause: error }
          );
        }
        throw error;
      }
      if (!provider.publicKey?.equals(operator)) {
        throw new Error("Phantom account changed or disconnected before broadcast. Reconnect the operator wallet.");
      }
      const sameBytes = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index]);
      // Extension providers can return objects from their own web3.js copy.
      // Validate canonical wire bytes rather than JavaScript constructor identity.
      let normalized: VersionedTransaction;
      try {
        normalized = VersionedTransaction.deserialize(Uint8Array.from(signed.serialize()));
      } catch {
        throw new Error("Wallet returned an invalid transaction. No transaction was submitted.");
      }
      if (!sameBytes(normalized.message.serialize(), expectedMessage)) {
        const changed = `expected message ${expectedMessage.length} bytes, returned ${normalized.message.serialize().length} bytes; returned instructions ${normalized.message.compiledInstructions.length}`;
        throw new Error(`Wallet changed the simulated transaction. No transaction was submitted. (${changed})`);
      }
      signed = normalized;
      if (signed.signatures.length !== expectedSignatures.length || signed.signatures.some(signature => !signature.some(byte => byte !== 0))) {
        throw new Error("Wallet returned an unsigned transaction. No transaction was submitted.");
      }
      if (expectedSignatures.some((signature, index) => signature.some(byte => byte !== 0) && !sameBytes(signature, signed.signatures[index]))) {
        throw new Error("Wallet changed a holder signature. No transaction was submitted.");
      }
      const signedBytes = Uint8Array.from(signed.serialize());
      attemptedSignature = base58Encode(signed.signatures[0]);
      const height = await rpc.getBlockHeight("confirmed");
      // Leave forwarding time after a slow human approval, not just one block.
      if (height + 20 >= latest.value.lastValidBlockHeight) {
        throw new Error("BLOCKHASH_EXPIRED_BEFORE_SEND");
      }
      if (!provider.publicKey?.equals(operator)) {
        throw new Error("Phantom account changed or disconnected before broadcast. Reconnect the operator wallet.");
      }

      // The signature exists locally before the RPC response. Persist it even
      // when the transport loses that response after accepting the payment.
      onSubmitted?.(attemptedSignature);
      broadcastAttempted = true;
      broadcastSignature = await rpc.sendRawTransaction(signedBytes, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        // RPC may forward the SAME signed bytes again; this cannot create a
        // second payment/signature. Never rebuild after broadcast.
        maxRetries: 20,
        minContextSlot: requiredContextSlot
      });
      onSubmitted?.(broadcastSignature);
      onProgress?.("submitted");
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
      onProgress?.("confirmed");
      return broadcastSignature;
    } catch (error) {
      lastError = error;
      // Once broadcast, never rebuild/re-sign a payment automatically: its
      // confirmation can be ambiguous even when the transfer actually landed.
      if (broadcastSignature) {
        // Confirmation subscriptions can lag or fail even after inclusion.
        // Reconcile this exact signature against history before reporting failure.
        try {
          const status = (await rpc.getSignatureStatuses([broadcastSignature], {
            searchTransactionHistory: true
          })).value[0];
          if (status && !status.err &&
              (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
            onProgress?.("confirmed");
            return broadcastSignature;
          }
        } catch {
          // Unavailable history is not success and must not authorize a retry.
        }
        throw new Error(`${label}: ${errorMessage(error)}. Transaction ${broadcastSignature} was submitted. Check its Devnet Explorer status and balances before retrying.`, { cause: error });
      }
      if (broadcastAttempted) {
        throw new Error(`${label}: broadcast outcome is unknown for transaction ${attemptedSignature}. Check the action and balances before retrying. ${errorMessage(error)}`, { cause: error });
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
