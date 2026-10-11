import { useId } from 'react';

/** Hand-drawn, code-native marks. No fetched artwork or image dependencies. */
export function KaseMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 40 38" fill="none" role="img" aria-label="KASE">
    <path className="kase-face" d="M20 2 2 34l18-9V2Z" fill="#35bd64" />
    <path className="kase-face" d="m20 2 18 32-18-9V2Z" fill="#b4ed80" />
    <path className="kase-face" d="m2 34 18-9 18 9H2Z" fill="#178b55" />
  </svg>;
}

export function SolanaMark({ className = '' }: { className?: string }) {
  const gradient = `solana-${useId().replace(/:/g, '')}`;
  return <svg className={className} viewBox="0 0 40 34" fill="none" role="img" aria-label="Solana">
    <defs><linearGradient id={gradient} x1="32" y1="0" x2="8" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#14f195" /><stop offset=".48" stopColor="#73c2e0" /><stop offset="1" stopColor="#9945ff" /></linearGradient></defs>
    <path className="solana-bar" d="m8 1-7 7h31l7-7H8Z" fill={`url(#${gradient})`} />
    <path className="solana-bar" d="m1 13 7 7h31l-7-7H1Z" fill={`url(#${gradient})`} />
    <path className="solana-bar" d="m8 25-7 7h31l7-7H8Z" fill={`url(#${gradient})`} />
  </svg>;
}
