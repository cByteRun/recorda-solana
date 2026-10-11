import type { ReactNode } from 'react';
import '../../src/app/styles/globals.css';
export const metadata = { title: 'Recorda · Rights, carried forward', description: 'Ownership changes. Rights stay recorded. Service tokenized bonds through payments, voting and redemption with verifiable outcomes on Solana.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
