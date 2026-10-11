/** A folded record: an anchored spine and three rights carried forward. */
export function RecordaMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path className="record-spine" d="M13 49V15l13-7v34L13 49Z" fill="currentColor" />
    <path className="record-fold" d="m30 8 22 12-13 7-9-5V8Z" fill="currentColor" opacity=".95" />
    <path className="record-fold" d="m30 27 22 12-13 7-9-5V27Z" fill="currentColor" opacity=".7" />
    <path className="record-fold" d="m30 46 17 9-13 7-4-2V46Z" fill="currentColor" opacity=".45" />
  </svg>;
}
