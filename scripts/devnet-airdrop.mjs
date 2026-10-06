import { airdrop, devnetConnection } from './devnet.mjs';
if (!process.argv[2]) throw new Error('Usage: npm run solana:airdrop -- <public-wallet-address>');
try {
  console.log(await airdrop(await devnetConnection(), process.argv[2]));
} catch (error) {
  console.error(error.message);
  console.error('If the faucet is rate limited, use https://faucet.solana.com/ then retry the golden replay. No private key is needed.');
  process.exitCode = 1;
}
