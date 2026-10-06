import type { ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export function PipelineStep({
  index,
  title,
  description,
  done,
  disabled,
  actionLabel,
  onAction,
  children
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  disabled?: boolean;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  children?: ReactNode;
}) {
  return (
    <article
      data-testid={`pipeline-step-${index}`}
      className={cn(
        "flow-line relative rounded-3xl border bg-white p-5 pl-16",
        done ? "border-emerald-200" : "border-zinc-200"
      )}
    >
      <div
        className={cn(
          "absolute left-4 top-5 grid h-10 w-10 place-items-center rounded-full text-sm font-bold",
          done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
          {children}
        </div>
        <Button
          size="sm"
          variant={done ? "outline" : "primary"}
          disabled={done || disabled}
          onClick={() => void onAction()}
        >
          {done ? "Confirmed" : actionLabel}
        </Button>
      </div>
    </article>
  );
}
