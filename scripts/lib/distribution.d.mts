import type {DistributionManifest} from '../../src/shared/solana/distribution';
export interface IndexInput {source:string;instrument:string;recordSlot:string;journalHash:string;holders:Array<{holder:string;units:string}>}
export function buildManifest(index:IndexInput,parameters:{distribution:string;paymentMint:string;face:string;rateBps:number;frequency:number;policyVersion:number;destinations:Record<string,string>}):DistributionManifest;
export function persistManifest(directory:string,manifest:DistributionManifest):{hash:string;path:string};
export function loadManifest(directory:string,hash:string):DistributionManifest;
