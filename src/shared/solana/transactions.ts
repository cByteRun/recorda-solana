import {
  Transaction,
  type Keypair,
  type PublicKey,
  type TransactionInstruction
} from "@solana/web3.js";
import { connection } from "@/shared/solana/config";
import type { PhantomProvider } from "@/shared/solana/phantom";

export function transactionFromInstructions(instructions: TransactionInstruction[]) {
  const tx = new Transaction();
  instructions.forEach((instruction) => tx.add(instruction));
  return tx;
}

export async function phantomSignAndSend({
  provider,
  operator,
  instructions,
  partialSigners = [],
  label = "transaction",
  maxBlockhashRetries = 2
}: {
  provider: PhantomProvider;
  operator: PublicKey;
  instructions: TransactionInstruction[];
  partialSigners?: Keypair[];
  label?: string;
  maxBlockhashRetries?: number;
}) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxBlockhashRetries; attempt += 1) {
    const tx = transactionFromInstructions(instructions);
    const latest = await connection.getLatestBlockhashAndContext("confirmed");
    tx.feePayer = operator;
    tx.recentBlockhash = latest.value.blockhash;
    partialSigners.forEach((signer) => tx.partialSign(signer));

    try {
      const signed = await provider.signTransaction(tx);
      const height = await connection.getBlockHeight("confirmed");

      if (height > latest.value.lastValidBlockHeight) {
        throw new Error("BLOCKHASH_EXPIRED_BEFORE_SEND");
      }

      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
        minContextSlot: latest.context.slot
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.value.blockhash,
          lastValidBlockHeight: latest.value.lastValidBlockHeight
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed with error: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (error) {
      lastError = error;
      const message = String(error instanceof Error ? error.message : error);
      const blockhashError =
        /Blockhash not found/i.test(message) ||
        /BlockhashNotFound/i.test(message) ||
        /block height exceeded/i.test(message) ||
        /BLOCKHASH_EXPIRED_BEFORE_SEND/i.test(message) ||
        /TransactionExpiredBlockheightExceeded/i.test(message);

      if (!blockhashError || attempt >= maxBlockhashRetries) {
        console.error(`${label} failed`, error);
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}
