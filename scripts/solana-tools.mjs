import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
export function solanaTool(name){const roots=[process.env.RECORDA_SOLANA_BIN,join(homedir(),'.local/share/solana/install/active_release/bin'),join(homedir(),'.local/share/solana/install/releases/2.3.0/solana-release/bin')].filter(Boolean);return roots.map(root=>join(root,name)).find(existsSync)??name;}
