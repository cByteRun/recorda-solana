import { fileURLToPath } from 'node:url';
/** @type {import('next').NextConfig} */
const config = {
  experimental: { useTypeScriptCli: false },
  typescript: { tsconfigPath: '../tsconfig.next.json' },
  webpack(config, { webpack }) {
    config.resolve.alias['@'] = fileURLToPath(new URL('../src', import.meta.url));
    config.resolve.alias['@golden'] = fileURLToPath(new URL('../golden', import.meta.url));
    config.plugins.push(new webpack.DefinePlugin({ 'import.meta.env': JSON.stringify({
      ...Object.fromEntries(["OPERATOR","REVIEWER","AUDITOR","HOLDER_A","HOLDER_B","HOLDER_C"].map(role=>[`VITE_RECORDA_${role}`,process.env[`NEXT_PUBLIC_RECORDA_${role}`] || process.env[`VITE_RECORDA_${role}`] || process.env[`RECORDA_${role}`] || ""])),
      PROD: process.env.NODE_ENV==='production',
      VITE_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      VITE_LOCAL_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_LOCAL_SOLANA_RPC_URL || process.env.VITE_LOCAL_SOLANA_RPC_URL || 'http://127.0.0.1:8899',
      VITE_LOCAL_RECORDA_PROGRAM_ID: process.env.NEXT_PUBLIC_LOCAL_RECORDA_PROGRAM_ID || process.env.VITE_LOCAL_RECORDA_PROGRAM_ID,
      VITE_DEVNET_RECORDA_PROGRAM_ID: process.env.NEXT_PUBLIC_DEVNET_RECORDA_PROGRAM_ID || process.env.VITE_DEVNET_RECORDA_PROGRAM_ID,
      VITE_RECORDA_PROGRAM_ID: process.env.NEXT_PUBLIC_RECORDA_PROGRAM_ID || process.env.VITE_RECORDA_PROGRAM_ID
    }) }));
    return config;
  }
};
export default config;
