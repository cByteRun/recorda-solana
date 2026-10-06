import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, getMint, createTransferCheckedInstruction, createThawAccountInstruction, createFreezeAccountInstruction, createCloseAccountInstruction, createTransferCheckedInstruction as transferFunding } from '@solana/spl-token';
const { Program, BN } = anchor;
const idl = JSON.parse(readFileSync('src/shared/solana/idl/recorda.json'));
const rpc = new Connection(process.env.RECORDA_TEST_RPC || 'http://127.0.0.1:8899', 'confirmed');
const program = new Program(idl, { connection: rpc });
const programId = new PublicKey(idl.address), tokenProgram = TOKEN_2022_PROGRAM_ID, systemProgram = SystemProgram.programId;
const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds.map(s => typeof s === 'string' ? Buffer.from(s) : s), programId)[0];
const bn = n => new BN(n.toString());
const u64 = n => bn(n).toArrayLike(Buffer, 'le', 8);
let nonce = 0;
const signatures = [];
async function send(ix, payer, signers = []) {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: ++nonce }), ix);
  const signature = await sendAndConfirmTransaction(rpc, tx, [payer, ...signers], { commitment: 'confirmed' });
  signatures.push(signature); return signature;
}
async function rejected(ix, payer, signers = [], pattern) {
  try { await send(ix, payer, signers); assert.fail('Expected on-chain rejection'); }
  catch (error) {
    if (error.code === 'ERR_ASSERTION') throw error;
    const logs = `${error.message}\n${(error.logs || []).join('\n')}`;
    assert.match(logs, /custom program error|Error Code|frozen/i);
    if (pattern) assert.match(logs, pattern);
  }
}
async function chainTime() { return await rpc.getBlockTime(await rpc.getSlot('confirmed')); }
const fixture = JSON.parse(readFileSync('golden/coupon-tz-section-22.json'));
const historical = JSON.parse(readFileSync('golden/coupon-happy-path.json'));
const evidence = { network: 'local-validator', program: idl.address, scenarios: [], negatives: [] };

test('Phase 1: real Token-2022 / Anchor Coupon Core and independent oracle', { timeout: 180_000 }, async t => {
  let failures = 0;
  const step = (name, work) => t.test(name, async context => {
    try { await work(context); } catch (error) { failures++; throw error; }
  });
  const executable = await rpc.getAccountInfo(programId);
  assert.ok(executable?.executable, 'Load target/deploy/recorda.so into local validator');
  const payer = Keypair.generate(), stranger = Keypair.generate();
  const airdrop = await rpc.requestAirdrop(payer.publicKey, 20_000_000_000);
  const latest = await rpc.getLatestBlockhash();
  await rpc.confirmTransaction({ signature: airdrop, ...latest }, 'confirmed');
  await send(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: stranger.publicKey, lamports: 1_000_000_000 }), payer);
  const paymentMint = await createMint(rpc, payer, payer.publicKey, payer.publicKey, 2, undefined, undefined, tokenProgram);
  const treasury = await createAccount(rpc, payer, paymentMint, payer.publicKey, undefined, undefined, tokenProgram);
  const inputScenarios = [
    { id: 1, name: 'TZ §22', snapshot: fixture.input.snapshot, expected: fixture.expected },
    { id: 2, name: 'historical regression', snapshot: historical.input.initialHolderBalances, expected: {
      supply: historical.expected.mintSupply, currentAfterTransfer: historical.expected.currentAfterTransfer,
      amountsMinor: Object.fromEntries(Object.keys(historical.input.initialHolderBalances).map(name => [name, historical.expected.settlementKusd[name] * 100])), totalMinor: historical.expected.settlementKusd.total * 100
    } }
  ];
  for (const scenario of inputScenarios) {
    const first = scenario.id === 1;
    const holders = Object.keys(scenario.snapshot).map(name => ({ name, key: Keypair.generate(), units: scenario.snapshot[name] }));
    const mint = pda('mint', payer.publicKey.toBuffer(), u64(scenario.id));
    const instrument = pda('instrument', mint.toBuffer());
    const action = pda('action', instrument.toBuffer(), u64(1));
    const vault = pda('vault', action.toBuffer()), receipt = pda('receipt', action.toBuffer());
    for (const h of holders) {
      h.position = pda('holder', instrument.toBuffer(), h.key.publicKey.toBuffer());
      h.bond = pda('bond-account', instrument.toBuffer(), h.key.publicKey.toBuffer());
      h.entitlement = pda('entitlement', action.toBuffer(), h.key.publicKey.toBuffer());
      h.destination = await createAccount(rpc, payer, paymentMint, h.key.publicKey, undefined, undefined, tokenProgram);
    }
    const manage = { authority: payer.publicKey, instrument, mint, action, tokenProgram };
    const ix = (method, args, accounts) => program.methods[method](...args).accountsStrict(accounts).instruction();
    const snapshotIx = h => ix('snapshotHolder', [], { authority: payer.publicKey, instrument, action, position: h.position, bondAccount: h.bond, entitlement: h.entitlement, tokenProgram, systemProgram });
    const calculateIx = h => ix('calculateEntitlement', [], { authority: payer.publicKey, instrument, action, entitlement: h.entitlement });
    const settleIx = (h, destination = h.destination, authority = payer.publicKey) => ix('settleHolder', [], { authority, instrument, action, entitlement: h.entitlement, paymentMint, vault, destination, tokenProgram });
    const transferIx = (from, to, units = 4) => ix('transferBonds', [bn(units)], { holder: from.key.publicKey, instrument, mint, fromPosition: from.position, toPosition: to.position, fromAccount: from.bond, toAccount: to.bond, tokenProgram });
    const fundingAccounts = { authority: payer.publicKey, instrument, action, vault, tokenProgram };
    await step(`${scenario.name}: Instrument → eligible positions`, async () => {
      await send(await ix('createInstrument', [bn(scenario.id), bn(fixture.input.terms.faceValueMinor), 1000, 2, bn((await chainTime()) + 86400), [...Buffer.from('MOCKUSD\0')]], { authority: payer.publicKey, instrument, mint, paymentMint, tokenProgram, systemProgram }), payer);
      for (const h of holders) await send(await ix('registerHolder', [bn(h.units)], { authority: payer.publicKey, instrument, mint, holder: h.key.publicKey, position: h.position, bondAccount: h.bond, tokenProgram, systemProgram }), payer);
      assert.equal((await getMint(rpc, mint, 'confirmed', tokenProgram)).supply, BigInt(scenario.expected.supply));
      for (const h of holders) { const account = await getAccount(rpc, h.bond, 'confirmed', tokenProgram); assert.equal(account.amount, BigInt(h.units)); assert.equal(account.isFrozen, true); }
    });
    if (first) await step('FR-07/08: revoke/approve zero holder and reject direct registry bypass', async () => {
      const d = holders[3];
      const change = approved => ix('setHolderApproved', [approved], { authority: payer.publicKey, instrument, position: d.position, bondAccount: d.bond });
      await send(await change(false), payer);
      await rejected(await transferIx(holders[0], d, 1), payer, [holders[0].key], /Eligibility/);
      await send(await change(true), payer);
      await rejected(await ix('setHolderApproved', [false], { authority: payer.publicKey, instrument, position: holders[0].position, bondAccount: holders[0].bond }), payer, [], /Balance/);
      const outsider = await createAccount(rpc, payer, mint, stranger.publicKey, undefined, undefined, tokenProgram);
      await rejected(createTransferCheckedInstruction(holders[0].bond, mint, outsider, holders[0].key.publicKey, 1n, 0, [], tokenProgram), payer, [holders[0].key], /frozen/i);
      await rejected(createThawAccountInstruction(holders[0].bond, mint, payer.publicKey, [], tokenProgram), payer);
      await rejected(createCloseAccountInstruction(d.bond, payer.publicKey, d.key.publicKey, [], tokenProgram), payer, [d.key]);
      assert.ok(await rpc.getAccountInfo(d.bond));
      evidence.negatives.push('registered zero account closure', 'registry bypass', 'revoke nonzero', 'revoked recipient', 'external thaw');
    });
    if (first) await step('M1.1/M1.2: wrong mint and unauthorized scheduling are rejected atomically', async () => {
      const wrongMint = await createMint(rpc, payer, payer.publicKey, null, 2, undefined, undefined, tokenProgram);
      const invalidAction = pda('action', instrument.toBuffer(), u64(98));
      const accounts = { authority: payer.publicKey, instrument, action: invalidAction, paymentMint, vault: pda('vault', invalidAction.toBuffer()), tokenProgram, systemProgram };
      await rejected(await ix('createCoupon', [bn(98), bn((await chainTime()) + 60)], { ...accounts, paymentMint: wrongMint }), payer, [], /ConstraintAddress/);
      await rejected(await ix('createCoupon', [bn(98), bn((await chainTime()) + 60)], { ...accounts, authority: stranger.publicKey }), payer, [stranger], /ConstraintHasOne/);
      assert.equal(await rpc.getAccountInfo(invalidAction), null);
      assert.equal(await rpc.getAccountInfo(accounts.vault), null);
      evidence.negatives.push('wrong settlement mint', 'unauthorized scheduling');
    });
    if (first) await step('M1.2: cancellation releases scheduled record barrier', async () => {
      const cancelled = pda('action', instrument.toBuffer(), u64(99));
      const cancelledVault = pda('vault', cancelled.toBuffer());
      await send(await ix('createCoupon', [bn(99), bn((await chainTime()) + 60)], { authority: payer.publicKey, instrument, action: cancelled, paymentMint, vault: cancelledVault, tokenProgram, systemProgram }), payer);
      await rejected(await ix('cancelAction', [], { ...manage, action: cancelled, authority: stranger.publicKey }), payer, [stranger], /ConstraintHasOne/);
      await send(await ix('cancelAction', [], { ...manage, action: cancelled }), payer);
      assert.deepEqual((await program.account.corporateAction.fetch(cancelled)).status, { cancelled: {} });
      assert.equal((await program.account.instrument.fetch(instrument)).pendingRecordTimestamp.toString(), '0');
      await rejected(await ix('beginSnapshot', [], { ...manage, action: cancelled }), payer, [], /State/);
    });
    const record = (await chainTime()) + (first ? 3 : 1);
    await send(await ix('createCoupon', [bn(1), bn(record)], { authority: payer.publicKey, instrument, action, paymentMint, vault, tokenProgram, systemProgram }), payer);
    if (first) {
      await rejected(await ix('beginSnapshot', [], manage), payer, [], /RecordDate/);
      await rejected(await ix('approveAction', [], manage), payer, [], /State/);
      await rejected(await ix('beginSnapshot', [], { ...manage, authority: stranger.publicKey }), payer, [stranger], /ConstraintHasOne/);
    }
    while ((await chainTime()) < record) await delay(400);
    if (first) await step('M1.2: late snapshot cannot accept post-record transfers or eligibility changes', async () => {
      await rejected(await transferIx(holders[0], holders[1]), payer, [holders[0].key], /Locked/);
      await rejected(await ix('setHolderApproved', [false], { authority: payer.publicKey, instrument, position: holders[3].position, bondAccount: holders[3].bond }), payer, [], /Locked/);
      assert.equal((await getAccount(rpc, holders[0].bond, 'confirmed', tokenProgram)).amount, 10n);
      const competing = pda('action', instrument.toBuffer(), u64(2));
      await rejected(await ix('createCoupon', [bn(2), bn((await chainTime()) + 60)], { authority: payer.publicKey, instrument, action: competing, paymentMint, vault: pda('vault', competing.toBuffer()), tokenProgram, systemProgram }), payer, [], /Locked/);
      assert.equal(await rpc.getAccountInfo(competing), null);
      evidence.negatives.push('post-record pre-snapshot transfer', 'post-record registry mutation', 'competing scheduled snapshot');
    });
    await step(`${scenario.name}: fixed record date → immutable snapshot`, async () => {
      await send(await ix('beginSnapshot', [], manage), payer);
      if (first) {
        await rejected(await transferIx(holders[0], holders[1]), payer, [holders[0].key], /Locked/);
        await rejected(await ix('finalizeSnapshot', [], manage), payer, [], /Supply/);
        await rejected(await ix('snapshotHolder', [], { authority: payer.publicKey, instrument, action, position: holders[0].position, bondAccount: holders[1].bond, entitlement: holders[0].entitlement, tokenProgram, systemProgram }), payer, [], /Account/);
      }
      for (const h of holders) await send(await snapshotIx(h), payer);
      await send(await ix('finalizeSnapshot', [], manage), payer);
      const a = await program.account.corporateAction.fetch(action);
      assert.equal(a.snapshotUnits.toString(), String(scenario.expected.supply)); assert.ok(a.recordSlot.gtn(0));
      await send(await transferIx(holders[0], holders[1]), payer, [holders[0].key]);
      if (first) await rejected(await snapshotIx(holders[0]), payer);
      const after = await program.account.corporateAction.fetch(action);
      assert.deepEqual(after.snapshotHash, a.snapshotHash);
      // Independently reproduce the on-chain commitment in the recorded holder order.
      const hash = (...buffers) => createHash('sha256').update(Buffer.concat(buffers)).digest();
      let commitment = hash(action.toBuffer(), a.recordSlot.toArrayLike(Buffer, 'le', 8), a.recordTimestamp.toArrayLike(Buffer, 'le', 8));
      for (const h of holders) commitment = hash(commitment, h.key.publicKey.toBuffer(), u64(h.units));
      assert.deepEqual(Buffer.from(a.snapshotHash), commitment);
      for (const h of holders) {
        assert.equal((await program.account.entitlementPosition.fetch(h.entitlement)).snapshotUnits.toString(), String(h.units));
        assert.equal((await getAccount(rpc, h.bond, 'confirmed', tokenProgram)).amount, BigInt(scenario.expected.currentAfterTransfer[h.name]));
      }
    });
    await step(`${scenario.name}: protocol rights → independent expected amounts`, async () => {
      if (first) await rejected(await ix('calculateEntitlement', [], { authority: stranger.publicKey, instrument, action, entitlement: holders[0].entitlement }), payer, [stranger], /ConstraintHasOne/);
      for (const h of holders) await send(await calculateIx(h), payer);
      if (first) await rejected(await calculateIx(holders[0]), payer, [], /State/);
      for (const h of holders) {
        const right = await program.account.entitlementPosition.fetch(h.entitlement);
        assert.equal(right.amountMinor.toString(), String(scenario.expected.amountsMinor[h.name]));
        assert.equal(right.principalMinor.toString(), String(h.units * fixture.input.terms.faceValueMinor));
        assert.equal(right.votingPower.toString(), String(h.units));
      }
      assert.equal((await program.account.corporateAction.fetch(action)).totalObligationMinor.toString(), String(scenario.expected.totalMinor));
    });
    await step(`${scenario.name}: explicit authority → funded vault → resumable once-only settlement`, async () => {
      if (first) {
        await rejected(await settleIx(holders[0]), payer, [], /State/);
        await rejected(await ix('approveAction', [], { ...manage, authority: stranger.publicKey }), payer, [stranger], /ConstraintHasOne/);
      }
      await send(await ix('approveAction', [], manage), payer);
      const beforeFunding = await program.account.corporateAction.fetch(action);
      await rejected(await ix('markFunded', [], fundingAccounts), payer, [], /InsufficientFunds/);
      assert.deepEqual(await program.account.corporateAction.fetch(action), beforeFunding);
      await mintTo(rpc, payer, paymentMint, treasury, payer, scenario.expected.totalMinor, [], undefined, tokenProgram);
      await send(transferFunding(treasury, paymentMint, vault, payer.publicKey, BigInt(scenario.expected.totalMinor), 2, [], tokenProgram), payer);
      await send(await ix('markFunded', [], fundingAccounts), payer);
      if (first) await rejected(await settleIx(holders[0], holders[0].destination, stranger.publicKey), payer, [stranger], /ConstraintHasOne/);
      if (first) {
        const beforeAction = await program.account.corporateAction.fetch(action);
        const beforeRight = await program.account.entitlementPosition.fetch(holders[0].entitlement);
        const beforeVault = (await getAccount(rpc, vault, 'confirmed', tokenProgram)).amount;
        await send(createFreezeAccountInstruction(holders[0].destination, paymentMint, payer.publicKey, [], tokenProgram), payer);
        await rejected(await settleIx(holders[0]), payer, [], /frozen/i);
        assert.deepEqual(await program.account.corporateAction.fetch(action), beforeAction);
        assert.deepEqual(await program.account.entitlementPosition.fetch(holders[0].entitlement), beforeRight);
        assert.equal((await getAccount(rpc, vault, 'confirmed', tokenProgram)).amount, beforeVault);
        assert.equal((await getAccount(rpc, holders[0].destination, 'confirmed', tokenProgram)).amount, 0n);
        await send(createThawAccountInstruction(holders[0].destination, paymentMint, payer.publicKey, [], tokenProgram), payer);
        evidence.negatives.push('failed CPI atomic rollback');
      }
      await send(await settleIx(holders[0]), payer);
      if (first) {
        await rejected(await settleIx(holders[0]), payer, [], /AlreadySettled/);
        await rejected(await settleIx(holders[1], holders[0].destination), payer, [], /Account/);
        await rejected(await ix('finalizeAction', [], { authority: payer.publicKey, instrument, action, receipt, systemProgram }), payer, [], /State/);
        assert.equal((await program.account.corporateAction.fetch(action)).processedHolders, 1);
        assert.equal((await getAccount(rpc, holders[0].destination, 'confirmed', tokenProgram)).amount, BigInt(scenario.expected.amountsMinor.A));
      }
      // A new client reads per-holder chain state and resumes only unpaid positions.
      const restored = new Program(idl, { connection: rpc });
      for (const h of holders) if (!(await restored.account.entitlementPosition.fetch(h.entitlement)).settled) await send(await settleIx(h), payer);
      for (const h of holders) {
        assert.equal((await getAccount(rpc, h.destination, 'confirmed', tokenProgram)).amount, BigInt(scenario.expected.amountsMinor[h.name]));
        const right = await restored.account.entitlementPosition.fetch(h.entitlement);
        assert.ok(right.destination.equals(h.destination));
        assert.equal(right.settledAmountMinor.toString(), String(scenario.expected.amountsMinor[h.name]));
      }
      assert.equal((await getAccount(rpc, vault, 'confirmed', tokenProgram)).amount, 0n);
      if (first) evidence.negatives.push('before record date', 'unauthorized snapshot/approve/settle', 'invalid transition', 'snapshot pause', 'incomplete supply', 'snapshot mutation', 'insufficient funding', 'double settlement', 'wrong destination', 'premature finalization');
    });
    await step(`${scenario.name}: receipt → verifiable finalized outcome`, async () => {
      const finalSignature = await send(await ix('finalizeAction', [], { authority: payer.publicKey, instrument, action, receipt, systemProgram }), payer);
      const r = await program.account.actionReceipt.fetch(receipt), a = await program.account.corporateAction.fetch(action);
      assert.deepEqual(r.finalStatus, { finalized: {} }); assert.deepEqual(a.status, { finalized: {} });
      assert.equal(r.settledTotalMinor.toString(), String(scenario.expected.totalMinor)); assert.equal(r.processedHolders, holders.length);
      const summary = createHash('sha256').update(Buffer.concat([action.toBuffer(), Buffer.from(a.snapshotHash), u64(scenario.expected.totalMinor), Buffer.from(new Uint32Array([holders.length]).buffer), u64(r.finalizedSlot)])).digest();
      assert.deepEqual(Buffer.from(r.summaryHash), summary);
      if (first) await rejected(await settleIx(holders[0]), payer, [], /State/);
      evidence.scenarios.push({ name: scenario.name, expected: scenario.expected, actual: await Promise.all(holders.map(async h => { const right = await program.account.entitlementPosition.fetch(h.entitlement); return { holder: h.name, snapshotUnits: right.snapshotUnits.toString(), currentUnits: (await getAccount(rpc, h.bond, 'confirmed', tokenProgram)).amount.toString(), entitlementMinor: right.amountMinor.toString(), settledMinor: right.settledAmountMinor.toString(), destination: right.destination.toBase58() }; })), mint: mint.toBase58(), instrument: instrument.toBase58(), action: action.toBase58(), receipt: receipt.toBase58(), totalMinor: r.settledTotalMinor.toString(), processedHolders: r.processedHolders, finalSignature });
    });
  }
  await step('M1.1/M1.3: parameter validation, rounding and arithmetic rollback on-chain', async () => {
    const make = (id, settlement = paymentMint) => {
      const mint = pda('mint', payer.publicKey.toBuffer(), u64(id)), instrument = pda('instrument', mint.toBuffer());
      return { authority: payer.publicKey, instrument, mint, paymentMint: settlement, tokenProgram, systemProgram };
    };
    const create = (accounts, id, face, bps, periods, maturity) => program.methods.createInstrument(bn(id), bn(face), bps, periods, bn(maturity), [...Buffer.from('MOCKUSD\0')]).accountsStrict(accounts).instruction();
    for (const [id, face, bps, periods, maturity] of [
      [10, 0, 1000, 2, (await chainTime()) + 86400],
      [11, 100000, 10001, 2, (await chainTime()) + 86400],
      [12, 100000, 1000, 0, (await chainTime()) + 86400],
      [13, 100000, 1000, 2, (await chainTime()) - 1]
    ]) {
      const accounts = make(id);
      await rejected(await create(accounts, id, face, bps, periods, maturity), payer, [], /Parameters/);
      assert.equal(await rpc.getAccountInfo(accounts.instrument), null);
      assert.equal(await rpc.getAccountInfo(accounts.mint), null);
    }
    const wrongDecimals = await createMint(rpc, payer, payer.publicKey, null, 6, undefined, undefined, tokenProgram);
    await rejected(await create(make(14, wrongDecimals), 14, 100000, 1000, 2, (await chainTime()) + 86400), payer, [], /Parameters/);
    for (const [id, units, face, bps, periods, expected] of [
      [20, 1, '101', 333, 3, '1'],
      [21, 2, '18446744073709551615', 10000, 1, null]
    ]) {
      const accounts = make(id), { instrument, mint } = accounts;
      await send(await create(accounts, id, face, bps, periods, (await chainTime()) + 86400), payer);
      const holder = Keypair.generate().publicKey;
      const position = pda('holder', instrument.toBuffer(), holder.toBuffer()), bondAccount = pda('bond-account', instrument.toBuffer(), holder.toBuffer());
      const action = pda('action', instrument.toBuffer(), u64(1)), entitlement = pda('entitlement', action.toBuffer(), holder.toBuffer());
      await send(await program.methods.registerHolder(bn(units)).accountsStrict({ authority: payer.publicKey, instrument, mint, holder, position, bondAccount, tokenProgram, systemProgram }).instruction(), payer);
      const record = (await chainTime()) + 1;
      await send(await program.methods.createCoupon(bn(1), bn(record)).accountsStrict({ authority: payer.publicKey, instrument, action, paymentMint, vault: pda('vault', action.toBuffer()), tokenProgram, systemProgram }).instruction(), payer);
      while ((await chainTime()) < record) await delay(200);
      const manage = { authority: payer.publicKey, instrument, action, mint, tokenProgram };
      await send(await program.methods.beginSnapshot().accountsStrict(manage).instruction(), payer);
      await send(await program.methods.snapshotHolder().accountsStrict({ authority: payer.publicKey, instrument, action, position, bondAccount, entitlement, tokenProgram, systemProgram }).instruction(), payer);
      await send(await program.methods.finalizeSnapshot().accountsStrict(manage).instruction(), payer);
      const calculation = await program.methods.calculateEntitlement().accountsStrict({ authority: payer.publicKey, instrument, action, entitlement }).instruction();
      if (expected === null) {
        const before = await program.account.entitlementPosition.fetch(entitlement), beforeAction = await program.account.corporateAction.fetch(action);
        await rejected(calculation, payer, [], /Overflow/);
        assert.deepEqual(await program.account.entitlementPosition.fetch(entitlement), before);
        assert.deepEqual(await program.account.corporateAction.fetch(action), beforeAction);
      } else {
        await send(calculation, payer);
        assert.equal((await program.account.entitlementPosition.fetch(entitlement)).amountMinor.toString(), expected);
      }
    }
    evidence.negatives.push('invalid financial parameters', 'wrong settlement decimals', 'arithmetic overflow atomic rollback');
  });
  assert.equal(failures, 0, 'Failed subtests must not produce successful acceptance evidence');
  evidence.binarySha256 = createHash('sha256').update(readFileSync('target/deploy/recorda.so')).digest('hex');
  evidence.sourceSha256 = createHash('sha256').update(readFileSync('programs/recorda/src/lib.rs')).digest('hex');
  evidence.idlSha256 = createHash('sha256').update(readFileSync('src/shared/solana/idl/recorda.json')).digest('hex');
  evidence.signatures = signatures; evidence.verifiedAt = new Date().toISOString();
  mkdirSync('target/protocol-evidence', { recursive: true });
  writeFileSync('target/protocol-evidence/coupon.json', JSON.stringify(evidence, null, 2) + '\n');
});
