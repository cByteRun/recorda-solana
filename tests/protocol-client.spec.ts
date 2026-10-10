import { test, expect } from '@playwright/test';
import { BN } from '@coral-xyz/anchor';
import { AccountLayout, MintLayout, TOKEN_2022_PROGRAM_ID, type RawMint, type RawAccount } from '@solana/spl-token';
import { Connection, Keypair, PublicKey, SystemProgram, type AccountInfo } from '@solana/web3.js';
import { createProtocol, type ProtocolAccounts } from '../src/shared/solana/protocol';

// Controlled RPC/account-list boundary with real Anchor and SPL binary codecs.
// Validator authorization is covered separately by protocol-tests/coupon.test.mjs.
async function fixture() {
  const rpc = new Connection('http://127.0.0.1:8899');
  const client = createProtocol(rpc), { pdas, program } = client;
  const authority = Keypair.generate().publicKey, holder = Keypair.generate().publicKey;
  const mint = pdas.mint(authority, 1), instrument = pdas.instrument(mint), action = pdas.action(instrument, 1);
  const paymentMint = Keypair.generate().publicKey, vault = pdas.vault(action), bond = pdas.bondAccount(instrument, holder);
  const bn = (value = 0) => new BN(value);
  const state: ProtocolAccounts['corporateAction'] = { id: bn(1), instrument, authority, approvedBy: PublicKey.default,
    recordTimestamp: bn(100), recordSlot: bn(0), snapshotTimestamp: bn(0), snapshotHash: Array(32).fill(0), status: { scheduled: {} },
    expectedHolders: 0, expectedSupply: bn(0), snapshotHolders: 0, snapshotUnits: bn(0), calculatedHolders: 0,
    totalObligationMinor: bn(0), settledTotalMinor: bn(0), processedHolders: 0, updatedSlot: bn(1), updatedAt: bn(1), bump: 0 };
  const terms: ProtocolAccounts['instrument'] = { id: bn(1), authority, mint, paymentMint, faceValueMinor: bn(100000),
    currency: [...Buffer.from('MOCKUSD\0')], couponBps: 1000, paymentsPerYear: 2, maturityTimestamp: bn(10000),
    outstandingSupply: bn(10), redeemedSupply: bn(0), registeredCount: 1, approvedCount: 1, sealed: false,
    snapshotPending: false, activeSnapshot: PublicKey.default, pendingRecordTimestamp: bn(100), redeemed: false, bump: 0 };
  const positions = [{ publicKey: pdas.holder(instrument, holder), account: { instrument, holder, tokenAccount: bond, approved: true } }];
  const rights = [{ publicKey: pdas.entitlement(action, holder), account: { action, holder, snapshotUnits: bn(10), snapshotIndex: 1,
    amountMinor: bn(), principalMinor: bn(), finalCouponMinor: bn(), votingPower: bn(), calculated: false, settled: false,
    settledSlot: bn(), destination: PublicKey.default, settledAmountMinor: bn() } }];
  const history = [{ publicKey: action, account: state }];
  const accounts = new Map<string, AccountInfo<Buffer>>();
  const info = (data: Buffer, owner: PublicKey): AccountInfo<Buffer> => ({ data, owner, executable: false, lamports: 1000000, rentEpoch: 0 });
  const mintState: RawMint = { mintAuthorityOption: 1, mintAuthority: instrument, supply: 10n, decimals: 0,
    isInitialized: true, freezeAuthorityOption: 1, freezeAuthority: instrument };
  const tokenState = (mint: PublicKey, owner: PublicKey, amount: bigint, state: RawAccount['state'] = 1): RawAccount => ({ mint, owner, amount,
    delegateOption: 0, delegate: PublicKey.default, state, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n,
    closeAuthorityOption: 0, closeAuthority: PublicKey.default });
  const vaultState = tokenState(paymentMint, action, 0n), bondState = tokenState(mint, holder, 10n, 2);
  bondState.closeAuthorityOption = 1; bondState.closeAuthority = instrument;
  async function encode() {
    accounts.set(action.toBase58(), info(await program.coder.accounts.encode('corporateAction', state), program.programId));
    accounts.set(instrument.toBase58(), info(await program.coder.accounts.encode('instrument', terms), program.programId));
    const mintBytes = Buffer.alloc(MintLayout.span); MintLayout.encode(mintState, mintBytes);
    accounts.set(mint.toBase58(), info(mintBytes, TOKEN_2022_PROGRAM_ID));
    for (const [address, state] of [[vault, vaultState], [bond, bondState]] as const) {
      const bytes = Buffer.alloc(AccountLayout.span); AccountLayout.encode(state, bytes);
      accounts.set(address.toBase58(), info(bytes, TOKEN_2022_PROGRAM_ID));
    }
  }
  rpc.getAccountInfo = async address => accounts.get(address.toBase58()) ?? null;
  rpc.getSignaturesForAddress = async () => [];
  program.account.holderPosition.all = async () => positions;
  program.account.entitlementPosition.all = async () => rights;
  program.account.corporateAction.all = async () => history;
  await encode();
  return { client, action, instrument, mint, accounts, state, terms, positions, rights, history, mintState, vaultState, bondState, encode };
}

test('FR-09/42 validated read preserves exact balances without a wallet', async () => {
  const f = await fixture(), report = await f.client.read(f.action);
  expect(report.balances[0].units).toBe('10'); expect(report.mintSupply).toBe(10n); expect(report.receipt).toBeNull();
});

type Fixture = Awaited<ReturnType<typeof fixture>>;
const attacks: Array<[string, (f: Fixture) => void, string]> = [
  ['action owner', f => { f.accounts.get(f.action.toBase58())!.owner = SystemProgram.programId; }, 'not owned by the Recorda program'],
  ['instrument owner', f => { f.accounts.get(f.instrument.toBase58())!.owner = SystemProgram.programId; }, 'not owned by the Recorda program'],
  ['action ID', f => { f.state.id = new BN(2); }, 'canonical Recorda PDA'],
  ['instrument mint', f => { f.terms.mint = Keypair.generate().publicKey; }, 'canonical Recorda PDA'],
  ['mint authority', f => { f.mintState.mintAuthority = Keypair.generate().publicKey; }, 'Bond mint authority/decimals'],
  ['freeze authority', f => { f.mintState.freezeAuthority = Keypair.generate().publicKey; }, 'Bond mint authority/decimals'],
  ['mint decimals', f => { f.mintState.decimals = 2; }, 'Bond mint authority/decimals'],
  ['vault mint', f => { f.vaultState.mint = Keypair.generate().publicKey; }, 'Settlement vault mint/authority'],
  ['vault owner', f => { f.vaultState.owner = Keypair.generate().publicKey; }, 'Settlement vault mint/authority'],
  ['right PDA', f => { f.rights[0].publicKey = Keypair.generate().publicKey; }, 'Entitlement address'],
  ['right action', f => { f.rights[0].account.action = Keypair.generate().publicKey; }, 'Entitlement address'],
  ['history PDA', f => { f.history[0].publicKey = Keypair.generate().publicKey; }, 'History action address'],
  ['holder PDA', f => { f.positions[0].publicKey = Keypair.generate().publicKey; }, 'Holder address'],
  ['holder token address', f => { f.positions[0].account.tokenAccount = Keypair.generate().publicKey; }, 'Holder address'],
  ['holder token mint', f => { f.bondState.mint = Keypair.generate().publicKey; }, 'Holder token account mint/owner'],
  ['holder token owner', f => { f.bondState.owner = Keypair.generate().publicKey; }, 'Holder token account mint/owner'],
  ['missing registry holder', f => { f.positions.length = 0; }, 'Holder registry count mismatch'],
  ['wrong approval count', f => { f.terms.approvedCount = 0; }, 'Holder registry count mismatch'],
  ['unfrozen bond', f => { f.bondState.state = 1; }, 'freeze/close authority mismatch'],
  ['holder close authority', f => { f.bondState.closeAuthority = f.bondState.owner; }, 'freeze/close authority mismatch'],
  ['current balance omission', f => { f.bondState.amount = 9n; }, 'do not reconcile with mint supply']
];
for (const [attack, mutate, message] of attacks) {
  test(`FR-42 NFR-11 RPC account substitution: ${attack}`, async () => {
    const f = await fixture(); mutate(f);
    // Re-encode mutated fields; owner substitutions act on the account envelope directly.
    if (!attack.endsWith(' owner') || attack === 'vault owner' || attack === 'holder token owner') await f.encode();
    await expect(f.client.read(f.action)).rejects.toThrow(message);
  });
}
