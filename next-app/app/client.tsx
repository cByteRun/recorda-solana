'use client';
import dynamic from 'next/dynamic';
import { Buffer } from 'buffer';
// Match the existing browser entry: Solana codecs require Buffer before app imports execute.
globalThis.Buffer = Buffer;
const Recorda = dynamic(() => import('../../src/app/App').then(module => module.App), { ssr: false, loading: () => <p className="p-8">Loading Recorda…</p> });
export default function ClientApplication() { return <Recorda />; }
