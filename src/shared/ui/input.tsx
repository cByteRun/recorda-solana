import type { InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm shadow-xs outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:bg-zinc-100 disabled:text-zinc-500 aria-invalid:border-rose-600", className)} {...props} />;
}
