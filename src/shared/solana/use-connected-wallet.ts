import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useBondOps } from '@/features/bondops/model/bondops-context';
import { getPhantom } from './phantom';

export function useConnectedWallet() {
 const ops=useBondOps();
 const [wallet,setWallet]=useState<PublicKey|null>(()=>{try{return getPhantom().publicKey??null;}catch{return null;}});
 useEffect(()=>setWallet(ops.wallet?new PublicKey(ops.wallet):null),[ops.wallet]);
 return [wallet,setWallet] as const;
}
