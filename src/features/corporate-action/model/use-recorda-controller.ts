import { Buffer } from "buffer";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint
} from "@solana/spl-token";
import { INSTRUMENT, SETTLEMENT } from "@/entities/instrument/model/instrument";
import type { HolderId, HolderView } from "@/entities/holder/model/types";
import type { CorporateActionState } from "@/features/corporate-action/model/types";
import { GOLDEN_INPUT, GOLDEN_EXPECTED, goldenPass, runGoldenBlackBox } from "@/features/corporate-action/model/golden";
import { connection, MEMO_PROGRAM_ID } from "@/shared/solana/config";
import { getPhantom, type PhantomProvider } from "@/shared/solana/phantom";
import { loadJson, loadOrCreateHolderKeypairs, saveJson, storageKeys } from "@/shared/solana/persistence";
import { phantomSignAndSend } from "@/shared/solana/transactions";

type RuntimeHolder = ReturnType<typeof loadOrCreateHolderKeypairs>[number] & {
  bondAta?: PublicKey;
  settlementAta?: PublicKey;
  currentBondUnits: number;
  settlementKusd: number;
  nativeSol: number;
};

interface DeploymentState {
  mint?: string;
  mintSecretKey?: number[];
  instrumentSig?: string;
  ataSig?: string;
  mintSig?: string;
  settlementMint?: string;
  settlementTreasuryAta?: string;
  settlementMintSig?: string;
  settlementAtaSig?: string;
  settlementFundSig?: string;
  stage?: string;
}

interface ControllerState {
  operator: string | null;
  operatorSol: number | null;
  deployment: DeploymentState | null;
  action: CorporateActionState | null;
  holders: HolderView[];
  busy: string | null;
  error: string | null;
}

const SETTLEMENT_BASE = 10 ** SETTLEMENT.decimals;

function memoInstruction(payload: unknown, signer?: PublicKey) {
  return new TransactionInstruction({
    keys: signer ? [{ pubkey: signer, isSigner: true, isWritable: false }] : [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(new TextEncoder().encode(JSON.stringify(payload)))
  });
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function emptyView(holder: RuntimeHolder): HolderView {
  return {
    id: holder.id,
    name: holder.name,
    owner: holder.keypair.publicKey.toBase58(),
    bondAta: holder.bondAta?.toBase58(),
    settlementAta: holder.settlementAta?.toBase58(),
    currentBondUnits: holder.currentBondUnits,
    snapshotUnits: null,
    entitlementUsd: null,
    settlementKusd: holder.settlementKusd,
    nativeSol: holder.nativeSol
  };
}

function snapshotMap(action: CorporateActionState | null) {
  return Object.fromEntries(
    action?.snapshot?.holders.map((holder) => [holder.id, holder.units]) ?? []
  ) as Partial<Record<HolderId, number>>;
}

export function useRecordaController() {
  const runtimeHolders = useRef<RuntimeHolder[]>(
    loadOrCreateHolderKeypairs().map((holder) => ({
      ...holder,
      currentBondUnits: 0,
      settlementKusd: 0,
      nativeSol: 0
    }))
  );
  const providerRef = useRef<PhantomProvider | null>(null);
  const operatorRef = useRef<PublicKey | null>(null);

  const [state, setState] = useState<ControllerState>(() => {
    const deployment = loadJson<DeploymentState>(storageKeys.deployment);
    const action = loadJson<CorporateActionState>(storageKeys.action);
    return {
      operator: null,
      operatorSol: null,
      deployment,
      action,
      holders: runtimeHolders.current.map(emptyView),
      busy: null,
      error: null
    };
  });

  const setBusy = useCallback((busy: string | null, error: string | null = null) => {
    setState((current) => ({ ...current, busy, error }));
  }, []);

  const refresh = useCallback(async () => {
    const deployment = loadJson<DeploymentState>(storageKeys.deployment);
    const action = loadJson<CorporateActionState>(storageKeys.action);
    const operator = operatorRef.current;

    if (!deployment?.mint) {
      setState((current) => ({
        ...current,
        deployment,
        action,
        operatorSol: operator ? current.operatorSol : null,
        holders: runtimeHolders.current.map(emptyView)
      }));
      return;
    }

    const mint = new PublicKey(deployment.mint);
    const settlementMint = deployment.settlementMint
      ? new PublicKey(deployment.settlementMint)
      : null;

    for (const holder of runtimeHolders.current) {
      holder.bondAta = getAssociatedTokenAddressSync(
        mint,
        holder.keypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        const account = await getAccount(connection, holder.bondAta, "confirmed", TOKEN_2022_PROGRAM_ID);
        holder.currentBondUnits = Number(account.amount);
      } catch {
        holder.currentBondUnits = 0;
      }

      holder.nativeSol = await connection.getBalance(holder.keypair.publicKey, "confirmed") / 1_000_000_000;

      if (settlementMint) {
        holder.settlementAta = getAssociatedTokenAddressSync(
          settlementMint,
          holder.keypair.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        try {
          const settlement = await getAccount(
            connection,
            holder.settlementAta,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
          );
          holder.settlementKusd = Number(settlement.amount) / SETTLEMENT_BASE;
        } catch {
          holder.settlementKusd = 0;
        }
      }
    }

    const snapshots = snapshotMap(action);
    const holderViews = runtimeHolders.current.map((holder) => ({
      ...emptyView(holder),
      snapshotUnits: snapshots[holder.id] ?? null,
      entitlementUsd: action?.entitlements?.[holder.id]?.usd ?? null
    }));

    const operatorSol = operator
      ? (await connection.getBalance(operator, "confirmed")) / 1_000_000_000
      : null;

    setState((current) => ({
      ...current,
      deployment,
      action,
      operatorSol,
      holders: holderViews
    }));
  }, []);

  const connect = useCallback(async () => {
    setBusy("Connecting Phantom…");
    try {
      const provider = getPhantom();
      const response = await provider.connect();
      providerRef.current = provider;
      operatorRef.current = response.publicKey;
      setState((current) => ({
        ...current,
        operator: response.publicKey.toBase58(),
        error: null
      }));
      await refresh();
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
      return;
    }
    setBusy(null);
  }, [refresh, setBusy]);

  const send = useCallback(async (
    instructions: TransactionInstruction[],
    partialSigners: Keypair[] = [],
    label = "transaction"
  ) => {
    const provider = providerRef.current;
    const operator = operatorRef.current;
    if (!provider || !operator) throw new Error("Connect Phantom first");

    return phantomSignAndSend({
      provider,
      operator,
      instructions,
      partialSigners,
      label
    });
  }, []);

  const deploy = useCallback(async () => {
    if (!operatorRef.current) throw new Error("Connect Phantom first");
    setBusy("Deploying / resuming KZB26…");
    try {
      let deployment = loadJson<DeploymentState>(storageKeys.deployment) ?? {};
      const operator = operatorRef.current;

      if (!deployment.mint) {
        const mintKeypair = Keypair.generate();
        deployment = {
          mint: mintKeypair.publicKey.toBase58(),
          mintSecretKey: Array.from(mintKeypair.secretKey),
          stage: "CANDIDATE"
        };
        saveJson(storageKeys.deployment, deployment);
      }

      const mintPublicKey = new PublicKey(deployment.mint!);
      let mintAccountInfo = await connection.getAccountInfo(mintPublicKey, "confirmed");

      if (!mintAccountInfo) {
        const mintKeypair = deployment.mintSecretKey
          ? Keypair.fromSecretKey(Uint8Array.from(deployment.mintSecretKey))
          : null;
        if (!mintKeypair) throw new Error("Missing saved mint keypair for resume");

        const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
        deployment.instrumentSig = await send(
          [
            SystemProgram.createAccount({
              fromPubkey: operator,
              newAccountPubkey: mintKeypair.publicKey,
              space: MINT_SIZE,
              lamports: rent,
              programId: TOKEN_2022_PROGRAM_ID
            }),
            createInitializeMintInstruction(
              mintKeypair.publicKey,
              INSTRUMENT.decimals,
              operator,
              operator,
              TOKEN_2022_PROGRAM_ID
            ),
            memoInstruction(
              {
                v: 0,
                type: "KASE_INSTRUMENT_CREATE",
                instrument: INSTRUMENT,
                mint: mintKeypair.publicKey.toBase58()
              },
              operator
            )
          ],
          [mintKeypair],
          "create KZB26 mint"
        );
        delete deployment.mintSecretKey;
        deployment.stage = "MINT_CREATED";
        saveJson(storageKeys.deployment, deployment);
        mintAccountInfo = await connection.getAccountInfo(mintPublicKey, "confirmed");
      }

      if (!mintAccountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        throw new Error("KZB26 mint is not Token-2022 owned");
      }

      const missingAtaInstructions: TransactionInstruction[] = [];
      for (const holder of runtimeHolders.current) {
        holder.bondAta = getAssociatedTokenAddressSync(
          mintPublicKey,
          holder.keypair.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        if (!(await connection.getAccountInfo(holder.bondAta, "confirmed"))) {
          missingAtaInstructions.push(
            createAssociatedTokenAccountInstruction(
              operator,
              holder.bondAta,
              holder.keypair.publicKey,
              mintPublicKey,
              TOKEN_2022_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }
      }

      if (missingAtaInstructions.length) {
        deployment.ataSig = await send(missingAtaInstructions, [], "create holder ATAs");
      }

      await refresh();

      const targets: Record<HolderId, number> = { A: 10, B: 20, C: 5 };
      const mintInstructions: TransactionInstruction[] = [];
      for (const holder of runtimeHolders.current) {
        const delta = targets[holder.id] - holder.currentBondUnits;
        if (delta < 0) throw new Error(`Holder ${holder.id} balance exceeds deployment target`);
        if (delta > 0 && holder.bondAta) {
          mintInstructions.push(
            createMintToCheckedInstruction(
              mintPublicKey,
              holder.bondAta,
              operator,
              delta,
              INSTRUMENT.decimals,
              [],
              TOKEN_2022_PROGRAM_ID
            )
          );
        }
      }

      if (mintInstructions.length) {
        deployment.mintSig = await send(mintInstructions, [], "mint initial KZB26 allocations");
      }

      deployment.stage = "READY";
      saveJson(storageKeys.deployment, deployment);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const snapshot = useCallback(async () => {
    setBusy("Creating record-date snapshot…");
    try {
      if (!operatorRef.current) throw new Error("Connect Phantom first");
      await refresh();
      const deployment = loadJson<DeploymentState>(storageKeys.deployment);
      if (!deployment?.mint) throw new Error("Deploy KZB26 first");

      const slot = await connection.getSlot("confirmed");
      const blockTime = await connection.getBlockTime(slot);
      const actionId = `CA-COUPON-${Date.now()}`;
      const holders = runtimeHolders.current.map((holder) => ({
        id: holder.id,
        owner: holder.keypair.publicKey.toBase58(),
        units: holder.currentBondUnits
      }));
      const base = { actionId, mint: deployment.mint, slot, blockTime, holders };
      const hash = await sha256(JSON.stringify(base));
      const signature = await send(
        [memoInstruction({ v: 0, type: "KASE_RECORD_DATE_SNAPSHOT", ...base, snapshotHash: hash }, operatorRef.current)],
        [],
        "snapshot"
      );

      const action: CorporateActionState = {
        actionId,
        status: "SNAPSHOTTED",
        snapshot: { slot, blockTime, hash, holders },
        signatures: { snapshot: signature }
      };
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const transfer = useCallback(async () => {
    setBusy("Transferring 4 KZB26 A → B…");
    try {
      const action = loadJson<CorporateActionState>(storageKeys.action);
      const deployment = loadJson<DeploymentState>(storageKeys.deployment);
      if (!action?.signatures.snapshot || !deployment?.mint) throw new Error("Snapshot first");
      const A = runtimeHolders.current.find((holder) => holder.id === "A")!;
      const B = runtimeHolders.current.find((holder) => holder.id === "B")!;
      if (!A.bondAta || !B.bondAta) await refresh();

      const signature = await send(
        [
          createTransferCheckedInstruction(
            A.bondAta!,
            new PublicKey(deployment.mint),
            B.bondAta!,
            A.keypair.publicKey,
            4,
            INSTRUMENT.decimals,
            [],
            TOKEN_2022_PROGRAM_ID
          ),
          memoInstruction({
            v: 0,
            type: "KASE_POST_RECORD_TRANSFER",
            actionId: action.actionId,
            from: "A",
            to: "B",
            units: 4,
            snapshotSig: action.signatures.snapshot
          }, operatorRef.current!)
        ],
        [A.keypair],
        "post-record transfer"
      );

      action.status = "POST_RECORD_TRANSFER";
      action.signatures.transfer = signature;
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const calculate = useCallback(async () => {
    setBusy("Calculating entitlement…");
    try {
      const action = loadJson<CorporateActionState>(storageKeys.action);
      if (!action?.snapshot) throw new Error("Snapshot first");
      const entries = {} as Record<HolderId, { units: number; usd: number; formula: string }>;
      let totalUsd = 0;
      for (const holder of action.snapshot.holders) {
        const usd = holder.units * INSTRUMENT.faceValueUsd * INSTRUMENT.annualCouponRate / INSTRUMENT.couponFrequency;
        entries[holder.id] = {
          units: holder.units,
          usd,
          formula: `${holder.units} × 1000 × 0.1 ÷ 2`
        };
        totalUsd += usd;
      }

      const signature = await send(
        [memoInstruction({
          v: 0,
          type: "KASE_ENTITLEMENT_ATTESTATION",
          actionId: action.actionId,
          snapshotSig: action.signatures.snapshot,
          snapshotHash: action.snapshot.hash,
          entitlements: entries,
          totalUsd
        }, operatorRef.current!)],
        [],
        "entitlement"
      );

      action.entitlements = Object.assign(entries, { totalUsd });
      action.status = "CALCULATED";
      action.signatures.entitlement = signature;
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const approve = useCallback(async () => {
    setBusy("Waiting for Phantom approval…");
    try {
      const action = loadJson<CorporateActionState>(storageKeys.action);
      if (!action?.signatures.entitlement) throw new Error("Calculate first");
      const signature = await send(
        [memoInstruction({
          v: 0,
          type: "KASE_OPERATOR_APPROVAL",
          actionId: action.actionId,
          entitlementSig: action.signatures.entitlement,
          operator: operatorRef.current!.toBase58(),
          approved: true,
          approvedAt: new Date().toISOString()
        }, operatorRef.current!)],
        [],
        "approval"
      );
      action.status = "APPROVED";
      action.signatures.approval = signature;
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const ensureSettlementRail = useCallback(async () => {
    let deployment = loadJson<DeploymentState>(storageKeys.deployment);
    if (!deployment?.mint || !operatorRef.current) throw new Error("Deploy and connect first");

    if (deployment.settlementMint && deployment.settlementTreasuryAta) {
      const settlementMint = new PublicKey(deployment.settlementMint);
      await getMint(connection, settlementMint, "confirmed", TOKEN_2022_PROGRAM_ID);
      for (const holder of runtimeHolders.current) {
        holder.settlementAta = getAssociatedTokenAddressSync(
          settlementMint,
          holder.keypair.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      }
      return deployment;
    }

    const operator = operatorRef.current;
    const mint = Keypair.generate();
    const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    deployment.settlementMintSig = await send(
      [
        SystemProgram.createAccount({
          fromPubkey: operator,
          newAccountPubkey: mint.publicKey,
          space: MINT_SIZE,
          lamports: rent,
          programId: TOKEN_2022_PROGRAM_ID
        }),
        createInitializeMintInstruction(
          mint.publicKey,
          SETTLEMENT.decimals,
          operator,
          operator,
          TOKEN_2022_PROGRAM_ID
        ),
        memoInstruction({ v: 0, type: "KASE_SETTLEMENT_RAIL_CREATE", symbol: SETTLEMENT.symbol }, operator)
      ],
      [mint],
      "create KUSD-DEV mint"
    );

    const treasuryAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      operator,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ataInstructions = [
      createAssociatedTokenAccountInstruction(
        operator,
        treasuryAta,
        operator,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    ];

    for (const holder of runtimeHolders.current) {
      holder.settlementAta = getAssociatedTokenAddressSync(
        mint.publicKey,
        holder.keypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      ataInstructions.push(
        createAssociatedTokenAccountInstruction(
          operator,
          holder.settlementAta,
          holder.keypair.publicKey,
          mint.publicKey,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    deployment.settlementAtaSig = await send(ataInstructions, [], "create KUSD ATAs");

    deployment.settlementFundSig = await send(
      [
        createMintToCheckedInstruction(
          mint.publicKey,
          treasuryAta,
          operator,
          SETTLEMENT.initialTreasurySupplyUi * SETTLEMENT_BASE,
          SETTLEMENT.decimals,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      ],
      [],
      "fund KUSD treasury"
    );

    deployment.settlementMint = mint.publicKey.toBase58();
    deployment.settlementTreasuryAta = treasuryAta.toBase58();
    saveJson(storageKeys.deployment, deployment);
    return deployment;
  }, [send]);

  const settle = useCallback(async () => {
    setBusy("Settling KUSD-DEV…");
    try {
      const action = loadJson<CorporateActionState>(storageKeys.action);
      if (!action?.signatures.approval || !action.entitlements) throw new Error("Approve first");
      if (action.signatures.settlement) throw new Error("Action already settled");
      const deployment = await ensureSettlementRail();
      const settlementMint = new PublicKey(deployment.settlementMint!);
      const treasuryAta = new PublicKey(deployment.settlementTreasuryAta!);

      await refresh();
      const pre = Object.fromEntries(
        runtimeHolders.current.map((holder) => [holder.id, holder.settlementKusd])
      ) as Record<HolderId, number>;

      const instructions: TransactionInstruction[] = [];
      for (const holder of runtimeHolders.current) {
        const amount = action.entitlements[holder.id].usd;
        instructions.push(
          createTransferCheckedInstruction(
            treasuryAta,
            settlementMint,
            holder.settlementAta!,
            operatorRef.current!,
            Math.round(amount * SETTLEMENT_BASE),
            SETTLEMENT.decimals,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );
      }
      instructions.push(memoInstruction({
        v: 0,
        type: "KASE_COUPON_SETTLEMENT",
        actionId: action.actionId,
        asset: SETTLEMENT.symbol,
        payouts: { A: 500, B: 1000, C: 250 }
      }, operatorRef.current!));

      const signature = await send(instructions, [], "KUSD settlement");
      action.status = "SETTLED";
      action.signatures.settlement = signature;
      action.preSettlementKusd = pre;
      saveJson(storageKeys.action, action);
      await refresh();

      const post = Object.fromEntries(
        runtimeHolders.current.map((holder) => [holder.id, holder.settlementKusd])
      ) as Record<HolderId, number>;

      action.preSettlementKusd = pre;
      action.postSettlementKusd = post;
      action.status = "SETTLED";
      action.signatures.settlement = signature;
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [ensureSettlementRail, refresh, send, setBusy]);

  const receipt = useCallback(async () => {
    setBusy("Writing ActionReceipt…");
    try {
      const action = loadJson<CorporateActionState>(storageKeys.action);
      const deployment = loadJson<DeploymentState>(storageKeys.deployment);
      if (!action?.signatures.settlement || !deployment?.mint) throw new Error("Settle first");
      const payload = {
        v: 0,
        type: "KASE_ACTION_RECEIPT",
        actionId: action.actionId,
        instrumentMint: deployment.mint,
        snapshotSig: action.signatures.snapshot,
        entitlementSig: action.signatures.entitlement,
        approvalSig: action.signatures.approval,
        settlementSig: action.signatures.settlement,
        finalStatus: "FINALIZED"
      };
      const signature = await send(
        [memoInstruction({ ...payload, receiptHash: await sha256(JSON.stringify(payload)) }, operatorRef.current!)],
        [],
        "receipt"
      );
      action.status = "FINALIZED";
      action.signatures.receipt = signature;
      saveJson(storageKeys.action, action);
      await refresh();
      setBusy(null);
    } catch (error) {
      setBusy(null, String(error instanceof Error ? error.message : error));
    }
  }, [refresh, send, setBusy]);

  const reset = useCallback(async () => {
    localStorage.removeItem(storageKeys.action);
    await refresh();
  }, [refresh]);

  const goldenReport = useMemo(() => {
    const actual = runGoldenBlackBox();
    return {
      input: GOLDEN_INPUT,
      expected: GOLDEN_EXPECTED,
      actual,
      pass: goldenPass(actual)
    };
  }, []);

  return {
    ...state,
    connect,
    deploy,
    snapshot,
    transfer,
    calculate,
    approve,
    settle,
    receipt,
    refresh,
    reset,
    goldenReport
  };
}

