import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import type { useRecordaController } from "@/features/corporate-action/model/use-recorda-controller";
import { Card, CardContent } from "@/shared/ui/card";

type Controller = ReturnType<typeof useRecordaController>;

export function GoldenOracle({ report }: { report: Controller["goldenReport"] }) {
  return (
    <Card data-testid="golden-oracle">
      <CardContent>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              <FlaskConical className="h-4 w-4" />
              Golden black-box oracle
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Known input → logic → expected output</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              SIMULATED · Offline calculation for TZ §22, in settlement minor units.
              PASS verifies the calculation contract. Payment and on-chain proof require the signed Devnet flow.
            </p>
          </div>

          <div
            data-testid="golden-pass"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
              report.pass
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {report.pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {report.pass ? "PASS" : "FAIL"}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <JsonBlock title="Input" value={report.input} />
          <JsonBlock title="Expected" value={report.expected} />
          <JsonBlock title="Actual" value={report.actual} testId="golden-actual" />
        </div>
      </CardContent>
    </Card>
  );
}

function JsonBlock({
  title,
  value,
  testId
}: {
  title: string;
  value: unknown;
  testId?: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-4 text-white">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</div>
      <pre data-testid={testId} className="mono mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-zinc-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
