/** Twelve recorded points form an R: a fixed spine, a loop and a forward stroke. */
export function RecordaMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path className="record-spine" d="M10 33V7h11a8 8 0 0 1 0 16H10m11 0 11 10" stroke="currentColor" strokeWidth="3.1" strokeLinejoin="round" />
    <circle className="record-point" cx="10" cy="7" r="2.5" fill="currentColor" />
    <circle className="record-point" cx="32" cy="33" r="2.5" fill="currentColor" />
  </svg>;
}
