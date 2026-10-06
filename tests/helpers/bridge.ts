import { expect, type Page } from '@playwright/test';
import { AccountLayout, MintLayout, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Controlled RPC/wallet boundary. Applies decoded client transfer instructions;
// does not emulate a validator or prove protocol authorization.
export async function bridge(page: Page, options: { snapshotFailure?: boolean; rejectApproval?: boolean; insufficientFunds?: boolean; wrongSnapshotOwner?: boolean; unavailableBond?: boolean; settlementConfirmationFailure?: boolean } = {}) {
  const operator = Keypair.generate();
  const mint = Keypair.generate().publicKey;
  const settlementMint = Keypair.generate().publicKey;
  const blockhash = Keypair.generate().publicKey.toBase58();
  const holders = ['A', 'B', 'C', 'D'].map((id, index) => ({ id, keypair: Keypair.generate(), units: [10, 5, 2, 0][index] }));
  const accounts = new Map<string, { mint: typeof mint; owner: typeof mint; amount: bigint }>();
  for (const holder of holders) {
    for (const asset of [mint, settlementMint]) {
      const ata = getAssociatedTokenAddressSync(asset, holder.keypair.publicKey, false, TOKEN_2022_PROGRAM_ID);
      accounts.set(ata.toBase58(), { mint: asset, owner: holder.keypair.publicKey, amount: asset.equals(mint) ? BigInt(holder.units) : 0n });
    }
  }
  const treasury = getAssociatedTokenAddressSync(settlementMint, operator.publicKey, false, TOKEN_2022_PROGRAM_ID);
  accounts.set(treasury.toBase58(), { mint: settlementMint, owner: operator.publicKey, amount: options.insufficientFunds ? 1n : 1000000n });
  const memos: Record<string, unknown>[] = [];
  const submitted: VersionedTransaction[] = [];
  const failures: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ operatorAddress, operatorBytes, storedHolders, deployment, rejectApproval }) => {
    if (!localStorage.getItem('bridge-seeded')) {
      localStorage.setItem('kase_real_holders_v2', JSON.stringify(storedHolders));
      localStorage.setItem('kase_real_deployment_v2', JSON.stringify(deployment));
      localStorage.setItem('bridge-seeded', 'yes');
    }
    const publicKey = {
      toBase58: () => operatorAddress,
      toBuffer: () => new Uint8Array(operatorBytes),
      toBytes: () => new Uint8Array(operatorBytes),
      equals: (other: { toBase58(): string }) => other.toBase58() === operatorAddress
    };
    let signs = 0;
    const provider = {
      isPhantom: true, publicKey,
      connect: async () => ({ publicKey }),
      signTransaction: async (tx: { signatures: Uint8Array[] }) => {
        signs++;
        if (rejectApproval && signs === 4) throw new Error('User rejected approval');
        tx.signatures[0] = new Uint8Array(64).fill(1);
        return tx;
      }
    };
    Object.assign(window, { phantom: { solana: provider } });
  }, {
    operatorAddress: operator.publicKey.toBase58(), operatorBytes: Array.from(operator.publicKey.toBytes()),
    storedHolders: holders.map(h => ({ id: h.id, name: `Investor ${h.id}`, secretKey: Array.from(h.keypair.secretKey) })),
    deployment: { mint: mint.toBase58(), settlementMint: settlementMint.toBase58(), settlementTreasuryAta: treasury.toBase58(), stage: 'READY' },
    rejectApproval: options.rejectApproval
  });
  function account(address: string) {
    const value = accounts.get(address);
    let data: Buffer;
    if (value) {
      data = Buffer.alloc(AccountLayout.span);
      AccountLayout.encode({ ...value, delegateOption: 0, delegate: operator.publicKey, state: 1, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: operator.publicKey }, data);
    } else if ([mint.toBase58(), settlementMint.toBase58()].includes(address)) {
      data = Buffer.alloc(MintLayout.span);
      MintLayout.encode({ mintAuthorityOption: 1, mintAuthority: operator.publicKey, supply: 17n, decimals: address === mint.toBase58() ? 0 : 2, isInitialized: true, freezeAuthorityOption: 1, freezeAuthority: operator.publicKey }, data);
    } else return null;
    return { data: [data.toString('base64'), 'base64'], executable: false, lamports: 10000000, owner: TOKEN_2022_PROGRAM_ID.toBase58(), rentEpoch: 0, space: data.length };
  }
  await page.routeWebSocket('wss://api.devnet.solana.com/**', socket => {
    socket.onMessage(message => {
      const request = JSON.parse(String(message));
      socket.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: request.method.endsWith('Unsubscribe') ? true : 1 }));
    });
  });
  await page.route('https://api.devnet.solana.com/**', async route => {
    const req = route.request().postDataJSON();
    const context = { slot: 100 };
    let result: unknown;
    let error: unknown;
    switch (req.method) {
      case 'getBalance': result = { context, value: 1000000000 }; break;
      case 'getAccountInfo':
        if (options.unavailableBond && accounts.get(req.params[0])?.mint.equals(mint)) error = { code: -32000, message: 'Balance RPC unavailable' };
        else result = { context, value: account(req.params[0]) };
        break;
      case 'getMultipleAccounts':
        if (options.snapshotFailure) error = { code: -32000, message: 'Snapshot RPC unavailable' };
        else {
          const values = req.params[0].map(account);
          if (options.wrongSnapshotOwner) {
            const data = Buffer.from(values[0].data[0], 'base64');
            operator.publicKey.toBuffer().copy(data, 32);
            values[0].data[0] = data.toString('base64');
          }
          result = { context, value: values };
        }
        break;
      case 'getBlockTime': result = 1700000000; break;
      case 'getLatestBlockhash': result = { context, value: { blockhash, lastValidBlockHeight: 1000 } }; break;
      case 'getBlockHeight': result = 100; break;
      case 'simulateTransaction': {
        const tx = VersionedTransaction.deserialize(Buffer.from(req.params[0], 'base64'));
        const insufficient = tx.message.compiledInstructions.some(ix => {
          if (!tx.message.staticAccountKeys[ix.programIdIndex].equals(TOKEN_2022_PROGRAM_ID) || ix.data[0] !== 12) return false;
          const source = accounts.get(tx.message.staticAccountKeys[ix.accountKeyIndexes[0]].toBase58());
          return !!source && source.amount < Buffer.from(ix.data).readBigUInt64LE(1);
        });
        result = { context, value: { err: insufficient ? { InstructionError: [0, 'InsufficientFunds'] } : null, logs: [], accounts: null, unitsConsumed: 1000 } };
        break;
      }
      case 'sendTransaction': {
        const tx = VersionedTransaction.deserialize(Buffer.from(req.params[0], 'base64'));
        submitted.push(tx);
        for (const ix of tx.message.compiledInstructions) {
          const program = tx.message.staticAccountKeys[ix.programIdIndex];
          if (program.equals(TOKEN_2022_PROGRAM_ID) && ix.data[0] === 12) {
            const from = accounts.get(tx.message.staticAccountKeys[ix.accountKeyIndexes[0]].toBase58())!;
            const to = accounts.get(tx.message.staticAccountKeys[ix.accountKeyIndexes[2]].toBase58())!;
            const amount = Buffer.from(ix.data).readBigUInt64LE(1);
            from.amount -= amount; to.amount += amount;
          } else if (program.toBase58().startsWith('Memo')) memos.push(JSON.parse(Buffer.from(ix.data).toString()));
        }
        result = '2'.repeat(88); break;
      }
      case 'getSignatureStatuses': result = { context, value: [{ slot: 100, confirmations: 1, err: options.settlementConfirmationFailure && submitted.length === 5 ? { InstructionError: [0, 'Custom'] } : null, confirmationStatus: 'confirmed' }] }; break;
      default: failures.push(req.method); error = { code: -32601, message: `Unexpected RPC ${req.method}` };
    }
    await route.fulfill({ json: { jsonrpc: '2.0', id: req.id, ...(error ? { error } : { result }) } });
  });
  await page.goto('/reference');
  await page.getByTestId('connect-wallet').click();
  await expect(page.getByTestId('busy-state')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId('current-A')).toHaveText(options.unavailableBond ? '—' : '10');
  return { memos, submitted, accounts, errors, failures };
}
