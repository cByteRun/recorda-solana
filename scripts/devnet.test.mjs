import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { airdrop, DEVNET_GENESIS } from './devnet.mjs';
const address = Keypair.generate().publicKey;
test('airdrop refuses a non-Devnet network before requesting funds', async () => {
  await assert.rejects(airdrop({ getGenesisHash: async () => 'mainnet', requestAirdrop: () => assert.fail('must not send') }, address), /Expected Solana Devnet/);
});
test('airdrop checks confirmed faucet signature and returns public balance', async () => {
  const result = await airdrop({
    getGenesisHash: async () => DEVNET_GENESIS,
    requestAirdrop: async (key, amount) => { assert.ok(key.equals(address)); assert.equal(amount, LAMPORTS_PER_SOL); return 'faucet-signature'; },
    getSignatureStatuses: async (signatures, options) => { assert.deepEqual(signatures, ['faucet-signature']); assert.equal(options.searchTransactionHistory, true); return { value: [{ err: null, confirmationStatus: 'confirmed' }] }; },
    getBalance: async () => LAMPORTS_PER_SOL
  }, address);
  assert.deepEqual(result, { signature: 'faucet-signature', address: address.toBase58(), balanceLamports: LAMPORTS_PER_SOL });
});
test('failed faucet transaction is not accepted as funding', async () => {
  await assert.rejects(airdrop({ getGenesisHash: async () => DEVNET_GENESIS, requestAirdrop: async () => 'failed', getSignatureStatuses: async () => ({ value: [{ err: 'failure', confirmationStatus: 'confirmed' }] }), getBalance: () => assert.fail('must not report success') }, address), /Airdrop failed/);
});
