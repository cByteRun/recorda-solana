import type { ReactNode } from 'react';
import '../../src/app/styles/globals.css';
export const metadata = { title: 'Recorda · Corporate actions', description: 'Record-date rights, voting and holder-signed redemption on Solana.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
