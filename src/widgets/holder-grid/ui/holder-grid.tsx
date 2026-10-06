import { ExternalLink } from "lucide-react";
import type { HolderView } from "@/entities/holder/model/types";
import { explorerAddress } from "@/shared/solana/config";
import { Card, CardContent } from "@/shared/ui/card";
import { formatUsd, shortAddress } from "@/shared/lib/utils";

export function HolderGrid({ holders }: { holders: HolderView[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="holder-grid">
      {holders.map((holder) => (
        <Card key={holder.id} data-testid={`holder-${holder.id}`}>
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{holder.name}</div>
                <a
                  href={explorerAddress(holder.owner)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono mt-1 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                >
                  {shortAddress(holder.owner, 10, 8)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                REAL KEYPAIR
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label="Current KZB26" value={holder.currentBondUnits ?? "—"} testId={`current-${holder.id}`} />
              <Metric label="Snapshot" value={holder.snapshotUnits ?? "—"} accent="blue" testId={`snapshot-${holder.id}`} />
              <Metric
                label="Native SOL (gas)"
                value={holder.nativeSol === null ? "—" : holder.nativeSol.toFixed(9)}
              />
              <Metric
                label="KUSD-DEV settlement"
                value={holder.settlementKusd === null ? "—" : holder.settlementKusd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                accent="violet"
                testId={`settlement-${holder.id}`}
              />
            </div>

            <div className="mt-3 rounded-xl bg-zinc-50 p-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Entitlement</div>
              <div className="mt-1 font-semibold" data-testid={`entitlement-${holder.id}`}>
                {holder.entitlementUsd === null ? "—" : formatUsd(holder.entitlementUsd)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  accent = "zinc",
  testId
}: {
  label: string;
  value: string | number;
  accent?: "zinc" | "blue" | "violet";
  testId?: string;
}) {
  const classes = {
    zinc: "bg-zinc-50 text-zinc-900",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700"
  }[accent];

  return (
    <div className={`rounded-xl p-3 ${classes}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold" data-testid={testId}>{value}</div>
    </div>
  );
}
