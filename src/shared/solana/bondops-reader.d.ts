import type { Connection } from '@solana/web3.js';
import type { Action, Instrument, Right } from '@/features/bondops/model/bondops-context';
export function createChainReader(endpoint?:string,options?:{rpc?:Connection;programId?:string;network?:'devnet'|'local'}):Promise<{sync(scopes:string[],previous:{actions:Action[]}):Promise<{instruments:Instrument[];actions:Action[]}>;transaction(signature:string,action:Action,right:Right):Promise<{status:Right['status'];evidence:string}>}>;
