import { BN, Program, type IdlAccounts } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAccount, getMint } from "@solana/spl-token";
import idl from "@/shared/solana/idl/recorda.json";
import type { Recorda } from "@/shared/solana/idl/recorda";

export type ProtocolAccounts = IdlAccounts<Recorda>;
export const RECORDA_PROGRAM_ID = new PublicKey(import.meta.env.VITE_RECORDA_PROGRAM_ID || idl.address);
export const u64 = (value: bigint | number | string) => new BN(value.toString());
export function protocolPdas(programId: PublicKey = RECORDA_PROGRAM_ID) {
  const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  const text = (s: string) => Buffer.from(s);
  const integer = (n: bigint | number | string) => u64(n).toArrayLike(Buffer, "le", 8);
  return {
    mint: (authority: PublicKey, id: bigint | number | string) => pda(text("mint"), authority.toBytes(), integer(id)),
    instrument: (mint: PublicKey) => pda(text("instrument"), mint.toBytes()),
    holder: (instrument: PublicKey, holder: PublicKey) => pda(text("holder"), instrument.toBytes(), holder.toBytes()),
    bondAccount: (instrument: PublicKey, holder: PublicKey) => pda(text("bond-account"), instrument.toBytes(), holder.toBytes()),
    action: (instrument: PublicKey, id: bigint | number | string) => pda(text("action"), instrument.toBytes(), integer(id)),
    entitlement: (action: PublicKey, holder: PublicKey) => pda(text("entitlement"), action.toBytes(), holder.toBytes()),
    vault: (action: PublicKey) => pda(text("vault"), action.toBytes()),
    receipt: (action: PublicKey) => pda(text("receipt"), action.toBytes())
  };
}
export function createProtocol(rpc: Connection, programId = RECORDA_PROGRAM_ID) {
  const program = new Program<Recorda>({ ...idl, address: programId.toBase58() } as Recorda, { connection: rpc });
  const pdas = protocolPdas(programId);
  const tokenProgram = TOKEN_2022_PROGRAM_ID;
  const systemProgram = SystemProgram.programId;
  async function ownedAccount<K extends keyof ProtocolAccounts>(name: K, address: PublicKey) {
    const info = await rpc.getAccountInfo(address, "confirmed");
    if (!info) throw new Error(`${name} account ${address.toBase58()} was not found`);
    if (!info.owner.equals(programId)) throw new Error(`${name} account is not owned by the Recorda program`);
    return program.coder.accounts.decode<ProtocolAccounts[K]>(name, info.data);
  }
  async function readReceipt(address: PublicKey) {
    const info = await rpc.getAccountInfo(address, "confirmed");
    if (!info) return null;
    if (!info.owner.equals(programId)) throw new Error("Receipt account is not owned by the Recorda program");
    return program.coder.accounts.decode<ProtocolAccounts["actionReceipt"]>("actionReceipt", info.data);
  }
  async function actionContext(action: PublicKey, authority: PublicKey) {
    const state = await ownedAccount("corporateAction", action);
    const instrument = state.instrument;
    const terms = await ownedAccount("instrument", instrument);
    return { accounts: { authority, instrument, action, mint: terms.mint, tokenProgram }, terms };
  }
  return {
    program, pdas,
    async createInstrument(authority: PublicKey, paymentMint: PublicKey, id: bigint, maturity: bigint) {
      const mint = pdas.mint(authority, id), instrument = pdas.instrument(mint);
      const instruction = await program.methods.createInstrument(u64(id), u64(100_000), 1000, 2, u64(maturity), [...Buffer.from("MOCKUSD\0")])
        .accountsStrict({ authority, instrument, mint, paymentMint, tokenProgram, systemProgram }).instruction();
      return { mint, instrument, instruction };
    },
    async registerHolder(authority: PublicKey, instrument: PublicKey, holder: PublicKey, units: bigint) {
      const terms = await ownedAccount("instrument", instrument);
      return program.methods.registerHolder(u64(units)).accountsStrict({ authority, instrument, mint: terms.mint, holder,
        position: pdas.holder(instrument, holder), bondAccount: pdas.bondAccount(instrument, holder), tokenProgram, systemProgram }).instruction();
    },
    async setApproved(authority: PublicKey, instrument: PublicKey, holder: PublicKey, approved: boolean) {
      return program.methods.setHolderApproved(approved).accountsStrict({ authority, instrument,
        position: pdas.holder(instrument, holder), bondAccount: pdas.bondAccount(instrument, holder) }).instruction();
    },
    async createCoupon(authority: PublicKey, instrument: PublicKey, id: bigint, recordTimestamp: bigint) {
      const terms = await ownedAccount("instrument", instrument), action = pdas.action(instrument, id);
      const instruction = await program.methods.createCoupon(u64(id), u64(recordTimestamp)).accountsStrict({ authority, instrument, action,
        paymentMint: terms.paymentMint, vault: pdas.vault(action), tokenProgram, systemProgram }).instruction();
      return { action, instruction };
    },
    async manage(action: PublicKey, authority: PublicKey, operation: "beginSnapshot" | "finalizeSnapshot" | "approveAction" | "cancelAction") {
      return program.methods[operation]().accountsStrict((await actionContext(action, authority)).accounts).instruction();
    },
    async snapshotHolder(action: PublicKey, authority: PublicKey, holder: PublicKey) {
      const { accounts: { instrument } } = await actionContext(action, authority);
      return program.methods.snapshotHolder().accountsStrict({ authority, instrument, action, position: pdas.holder(instrument, holder),
        bondAccount: pdas.bondAccount(instrument, holder), entitlement: pdas.entitlement(action, holder), tokenProgram, systemProgram }).instruction();
    },
    async calculate(action: PublicKey, authority: PublicKey, holder: PublicKey) {
      const { accounts: { instrument } } = await actionContext(action, authority);
      return program.methods.calculateEntitlement().accountsStrict({ authority, instrument, action, entitlement: pdas.entitlement(action, holder) }).instruction();
    },
    async transfer(instrument: PublicKey, holder: PublicKey, recipient: PublicKey, units: bigint) {
      const { mint } = await ownedAccount("instrument", instrument);
      return program.methods.transferBonds(u64(units)).accountsStrict({ holder, instrument, mint,
        fromPosition: pdas.holder(instrument, holder), toPosition: pdas.holder(instrument, recipient),
        fromAccount: pdas.bondAccount(instrument, holder), toAccount: pdas.bondAccount(instrument, recipient), tokenProgram }).instruction();
    },
    async markFunded(action: PublicKey, authority: PublicKey) {
      const { accounts: { instrument } } = await actionContext(action, authority);
      return program.methods.markFunded().accountsStrict({ authority, instrument, action, vault: pdas.vault(action), tokenProgram }).instruction();
    },
    async settle(action: PublicKey, authority: PublicKey, holder: PublicKey, destination: PublicKey) {
      const { accounts: { instrument }, terms: { paymentMint } } = await actionContext(action, authority);
      return program.methods.settleHolder().accountsStrict({ authority, instrument, action, entitlement: pdas.entitlement(action, holder),
        paymentMint, vault: pdas.vault(action), destination, tokenProgram }).instruction();
    },
    async finalize(action: PublicKey, authority: PublicKey) {
      const { accounts: { instrument } } = await actionContext(action, authority);
      return program.methods.finalizeAction().accountsStrict({ authority, instrument, action, receipt: pdas.receipt(action), systemProgram }).instruction();
    },
    async read(action: PublicKey) {
      const state = await ownedAccount("corporateAction", action);
      const terms = await ownedAccount("instrument", state.instrument);
      if (!pdas.instrument(terms.mint).equals(state.instrument) || !pdas.action(state.instrument, state.id.toString()).equals(action)) throw new Error("Instrument/action address does not match canonical Recorda PDA seeds");
      const [rights, positions, receipt, mint, vault, signatures, history] = await Promise.all([
        program.account.entitlementPosition.all([{ memcmp: { offset: 8, bytes: action.toBase58() } }]),
        program.account.holderPosition.all([{ memcmp: { offset: 8, bytes: state.instrument.toBase58() } }]),
        readReceipt(pdas.receipt(action)),
        getMint(rpc, terms.mint, "confirmed", tokenProgram),
        getAccount(rpc, pdas.vault(action), "confirmed", tokenProgram),
        rpc.getSignaturesForAddress(action, { limit: 100 }, "confirmed"),
        program.account.corporateAction.all([{ memcmp: { offset: 16, bytes: state.instrument.toBase58() } }])
      ]);
      if (mint.decimals !== 0 || !mint.mintAuthority?.equals(state.instrument) || !mint.freezeAuthority?.equals(state.instrument)) throw new Error("Bond mint authority/decimals mismatch");
      if (!vault.mint.equals(terms.paymentMint) || !vault.owner.equals(action)) throw new Error("Settlement vault mint/authority mismatch");
      for (const { publicKey, account } of rights) {
        if (!account.action.equals(action) || !pdas.entitlement(action, account.holder).equals(publicKey)) throw new Error("Entitlement address does not match canonical Recorda PDA seeds");
      }
      for (const { publicKey, account } of history) {
        if (!account.instrument.equals(state.instrument) || !pdas.action(state.instrument, account.id.toString()).equals(publicKey)) throw new Error("History action address does not match canonical Recorda PDA seeds");
      }
      const balances = await Promise.all(positions.map(async ({ publicKey, account: position }) => {
        if (!position.instrument.equals(state.instrument) || !pdas.holder(state.instrument, position.holder).equals(publicKey)
          || !pdas.bondAccount(state.instrument, position.holder).equals(position.tokenAccount)) throw new Error("Holder address does not match canonical Recorda PDA seeds");
        const balance = await getAccount(rpc, position.tokenAccount, "confirmed", tokenProgram);
        if (!balance.mint.equals(terms.mint) || !balance.owner.equals(position.holder)) throw new Error("Holder token account mint/owner mismatch");
        return { holder: position.holder.toBase58(), units: balance.amount.toString() };
      }));
      // BN stays exact through serialization; display monetary values using minor-unit strings.
      return { action: state, instrument: terms, rights, positions, receipt, mintSupply: mint.supply, vaultBalance: vault.amount, balances, signatures, history };
    }
  };
}
export type Protocol = ReturnType<typeof createProtocol>;
export type ProtocolReport = Awaited<ReturnType<Protocol["read"]>>;
export type ProtocolInstruction = TransactionInstruction;
