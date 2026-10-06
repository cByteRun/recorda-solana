import { useEffect } from "react";
import {
  Activity,
  Blocks,
  CircleDollarSign,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import { INSTRUMENT } from "@/entities/instrument/model/instrument";
import { useRecordaController } from "@/features/corporate-action/model/use-recorda-controller";
import { HolderGrid } from "@/widgets/holder-grid/ui/holder-grid";
import { PipelineStep } from "@/widgets/pipeline/ui/pipeline-step";
import { GoldenOracle } from "@/widgets/golden-oracle/ui/golden-oracle";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { explorerTx } from "@/shared/solana/config";
import { shortAddress } from "@/shared/lib/utils";

export function DashboardPage() {
  const recorda = useRecordaController();

  useEffect(() => {
    void recorda.refresh();
    // one bootstrap read; controller callbacks are intentionally stable enough for manual re-read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const action = recorda.action;
  const sig = action?.signatures ?? {};

  return (
    <div className="min-h-screen">
      <Header operator={recorda.operator} connect={recorda.connect} busy={!!recorda.busy} />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Hero />

        {recorda.error && (
          <div data-testid="app-error" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {recorda.error}
          </div>
        )}

        {recorda.busy && (
          <div data-testid="busy-state" className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
            {recorda.busy}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            eyebrow="Operator / Phantom"
            value={recorda.operator ? shortAddress(recorda.operator, 10, 8) : "Not connected"}
            detail={recorda.operatorSol === null ? "Connect to read Devnet balance" : `${recorda.operatorSol.toFixed(6)} SOL · gas only`}
          />
          <StatCard
            eyebrow="Bond / security"
            value={INSTRUMENT.symbol}
            detail={recorda.deployment?.mint ? shortAddress(recorda.deployment.mint, 10, 8) : "Token-2022 mint not deployed"}
          />
          <StatCard
            eyebrow="Corporate action"
            value={action?.status ?? "NOT_STARTED"}
            detail={action?.actionId ?? "Coupon vertical slice"}
          />
        </section>

        <section className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 font-semibold text-blue-950">
                <WalletCards className="h-5 w-5" />
                Phantom = Operator / Treasury. A/B/C/D = disposable Devnet investors.
              </div>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-blue-950/70">
                React сохраняет ту же бизнес-модель v4: bond ownership живёт в Token-2022 accounts,
                KUSD-DEV — settlement asset, SOL — только gas. На localhost:4444 используются те же localStorage keys,
                поэтому существующий v4 deployment может быть подхвачен.
              </p>
            </div>
            <Button variant="outline" onClick={() => void recorda.refresh()} disabled={!!recorda.busy}>
              <RefreshCw className="h-4 w-4" />
              Refresh RPC
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Step 0 · infrastructure</div>
              <h2 className="mt-1 text-2xl font-semibold">Real Token-2022 instrument</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                One-time deployment creates/reuses KZB26 and holder accounts. Current balances below are RPC reads, not fixture values.
              </p>
            </div>
            <Button
              variant="primary"
              data-testid="deploy-button"
              disabled={!recorda.operator || !!recorda.busy}
              onClick={() => void recorda.deploy()}
            >
              <Blocks className="h-4 w-4" />
              {recorda.deployment?.mint ? "Deploy / Resume KZB26" : "Deploy KZB26"}
            </Button>
          </div>

          <div className="mt-4">
            <HolderGrid holders={recorda.holders} />
          </div>
        </section>

        <section className="mt-10 grid gap-8 xl:grid-cols-[1fr_400px]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">One vertical slice</div>
            <h2 className="mt-1 text-2xl font-semibold">Coupon corporate action</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Пока это React port текущей v4 trust boundary: real Token-2022 state + Browser/Memo bridge.
              Следующий roadmap milestone заменяет middle layer на Anchor PDA state.
            </p>
            <p className="mt-2 text-sm text-zinc-600" data-testid="implementation-boundary">
              IMPLEMENTED: Token-2022 client transactions and signed Memo references.
              Client-owned snapshot, entitlement and status; protocol enforcement remains pending.
            </p>

            <div className="mt-5 space-y-4" data-testid="pipeline">
              <PipelineStep
                index={1}
                title="Record Date → real balances → immutable snapshot attestation"
                description="RPC читает A/B/C/D Token-2022 balances и Operator подписывает snapshot transaction."
                done={!!sig.snapshot}
                disabled={!recorda.deployment?.mint || !recorda.operator || !!sig.snapshot || !!recorda.busy}
                actionLabel="Create snapshot"
                onAction={recorda.snapshot}
              />
              <PipelineStep
                index={2}
                title="A реально переводит 4 KZB26 → B"
                description="Holder A keypair authorizes Token-2022 transfer. Current state changes; record-date snapshot stays fixed."
                done={!!sig.transfer}
                disabled={!sig.snapshot || !recorda.operator || !!sig.transfer || !!recorda.busy}
                actionLabel="Transfer A → B"
                onAction={recorda.transfer}
              />
              <PipelineStep
                index={3}
                title="Entitlement = function(snapshot), not current balance"
                description="10/5/2/0 snapshot produces $500/$250/$100/$0. This calculation moves into Anchor in Phase 1."
                done={!!sig.entitlement}
                disabled={!sig.transfer || !recorda.operator || !!sig.entitlement || !!recorda.busy}
                actionLabel="Calculate entitlement"
                onAction={recorda.calculate}
              />
              <PipelineStep
                index={4}
                title="HITL Operator approval"
                description="Phantom explicitly signs approval. Automatic calculation does not automatically move assets."
                done={!!sig.approval}
                disabled={!sig.entitlement || !recorda.operator || !!sig.approval || !!recorda.busy}
                actionLabel="Approve in Phantom"
                onAction={recorda.approve}
              />
              <PipelineStep
                index={5}
                title="Real Token-2022 KUSD-DEV settlement"
                description="500/250/100/0 KUSD-DEV moves to holder token accounts. Native SOL remains gas only."
                done={!!sig.settlement}
                disabled={!sig.approval || !recorda.operator || !!sig.settlement || !!action?.pendingSettlementSignature || !!recorda.busy}
                actionLabel="Settle KUSD"
                onAction={recorda.settle}
              />
              <PipelineStep
                index={6}
                title="ActionReceipt → final proof"
                description="Final signed receipt links the corporate-action stages. Phase 1 replaces Memo receipt with ActionReceipt PDA."
                done={!!sig.receipt}
                disabled={!sig.settlement || !recorda.operator || !!sig.receipt || !!recorda.busy}
                actionLabel="Finalize receipt"
                onAction={recorda.receipt}
              />
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <Card>
              <CardContent>
                <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Business invariant</div>
                <p className="mt-3 text-lg font-semibold leading-7">
                  Current ownership can change. Finalized record-date rights cannot.
                </p>
                <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                  Expected killer case: snapshot <b>10/5/2/0</b>, current after transfer <b>6/9/2/0</b>,
                  entitlement still <b>500/250/100/0 KUSD</b>.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Action references</div>
                <div className="mt-4 space-y-2">
                  {(["snapshot", "transfer", "entitlement", "approval", "settlement", "receipt"] as const).map((name) => (
                    <TxRow key={name} name={name} signature={sig[name]} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  <ShieldCheck className="h-4 w-4" />
                  Next trust boundary
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Browser/Memo → CorporateAction PDA + SnapshotPosition PDA + EntitlementPosition PDA + ActionReceipt PDA.
                </p>
              </CardContent>
            </Card>
          </aside>
        </section>

        <section className="mt-10" id="golden">
          <GoldenOracle report={recorda.goldenReport} />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <ValueCard
            icon={<Activity className="h-5 w-5" />}
            title="WHO + WHEN"
            text="Record date freezes the relevant ownership state even when tokens move later."
          />
          <ValueCard
            icon={<CircleDollarSign className="h-5 w-5" />}
            title="WHAT RIGHT"
            text="Financial entitlement is deterministic and explainable from the snapshot and instrument terms."
          />
          <ValueCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="EXECUTE + PROVE"
            text="Explicit authority controls execution and the final state remains independently verifiable."
          />
        </section>
      </main>
    </div>
  );
}

function Header({
  operator,
  connect,
  busy
}: {
  operator: string | null;
  connect: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div>
          <div className="text-sm font-semibold">Recorda · KASE Corporate Actions Engine</div>
          <div className="text-xs text-zinc-500">React Phase 1 · Solana Devnet · Token-2022</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">
            DEVNET ONLY
          </span>
          <Button data-testid="connect-wallet" disabled={busy} onClick={() => void connect()}>
            {operator ? shortAddress(operator) : "Connect Phantom"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-3xl bg-zinc-950 p-7 text-white md:p-9">
        <div className="text-xs font-semibold uppercase tracking-[.22em] text-zinc-500">Product axis</div>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">
          Record Date → Right → Controlled Execution → Verifiable Proof.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-300">
          Payroll engine for tokenized securities. Issuance is day zero; Recorda services the rights that ownership creates afterwards.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Why this product exists</div>
          <p className="mt-4 text-xl font-semibold leading-8">
            A wallet tells you what a holder owns now. Corporate actions must prove what they owned on the relevant date,
            what that created, what was executed and why.
          </p>
          <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
            Our edge is not Token-2022 issuance. It is the lifecycle semantics that bind historical ownership to investor rights and execution.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({ eyebrow, value, detail }: { eyebrow: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{eyebrow}</div>
        <div className="mt-2 break-all text-xl font-semibold">{value}</div>
        <div className="mt-2 text-xs leading-5 text-zinc-500">{detail}</div>
      </CardContent>
    </Card>
  );
}

function TxRow({ name, signature }: { name: string; signature?: string }) {
  return signature ? (
    <a
      href={explorerTx(signature)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-xs hover:bg-zinc-100"
    >
      <span className="capitalize">{name}</span>
      <span className="mono flex items-center gap-1 text-blue-600">
        {shortAddress(signature, 7, 5)}
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  ) : (
    <div className="flex items-center justify-between rounded-xl border border-zinc-100 p-3 text-xs text-zinc-400">
      <span className="capitalize">{name}</span>
      <span>—</span>
    </div>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card>
      <CardContent>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-950 text-white">{icon}</div>
        <div className="mt-4 font-semibold">{title}</div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
      </CardContent>
    </Card>
  );
}
