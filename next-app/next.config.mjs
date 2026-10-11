import { fileURLToPath } from 'node:url';
/** @type {import('next').NextConfig} */
const config = {
  experimental: { useTypeScriptCli: false },
  typescript: { tsconfigPath: '../tsconfig.next.json' },
  webpack(config, { webpack }) {
    config.resolve.alias['@'] = fileURLToPath(new URL('../src', import.meta.url));
    config.resolve.alias['@golden'] = fileURLToPath(new URL('../golden', import.meta.url));
    config.plugins.push(new webpack.DefinePlugin({ 'import.meta.env': JSON.stringify({
      VITE_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      VITE_RECORDA_PROGRAM_ID: process.env.NEXT_PUBLIC_RECORDA_PROGRAM_ID || process.env.VITE_RECORDA_PROGRAM_ID
    }) }));
    return config;
  }
};
export default config;
