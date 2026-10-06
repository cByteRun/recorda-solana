import { useState } from "react";
import { Button } from "@/shared/ui/button";

export function AddressLink({ value, href, label }: { value: string; href: string; label?: string }) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setFeedback("Copied"); }
    catch { setFeedback("Copy unavailable; open the link for the full address."); }
  }
  return <span className="inline-flex max-w-full flex-wrap items-center gap-2">
    <a href={href} title={value} target="_blank" rel="noreferrer" className="break-all text-sm text-blue-700 underline underline-offset-4">{label || `${value.slice(0, 6)}…${value.slice(-6)}`}</a>
    <Button variant="ghost" size="sm" aria-label={`Copy ${label || value}`} onClick={() => void copy()}>Copy</Button>
    <span role="status" className="text-xs text-zinc-600">{feedback}</span>
  </span>;
}
