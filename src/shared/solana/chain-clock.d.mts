import type { Connection } from '@solana/web3.js';
export interface ChainClock { timestamp: bigint; contextSlot: number }
export function readChainClock(rpc: Pick<Connection, 'getAccountInfoAndContext'>): Promise<ChainClock>;
export function waitForRecordDate(rpc: Pick<Connection, 'getAccountInfoAndContext'>, recordTimestamp: bigint | string, options?: { timeoutMs?: number; pollIntervalMs?: number; onProgress?: (clock: ChainClock) => void }): Promise<ChainClock>;
