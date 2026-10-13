import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Connection} from '@solana/web3.js';
import {solanaTool} from './solana-tools.mjs';
const idl=JSON.parse(readFileSync('src/shared/solana/idl/recorda.json'));
if(!existsSync('target/deploy/recorda.so'))throw Error('Run npm run protocol:build first');
const ledger=resolve(`target/bondops-local/ledger-${Date.now()}`);mkdirSync(ledger,{recursive:true});
const probe=new Connection('http://127.0.0.1:8899','confirmed');
let occupied=false;try{await probe.getVersion();occupied=true;}catch{}
if(occupied)throw Error('RPC port 8899 is already in use. Stop your local validator explicitly before creating a fresh BondOps ledger.');
const validatorBin=solanaTool('solana-test-validator');
const validator=spawn(validatorBin,['--ledger',ledger,'--bpf-program',idl.address,'target/deploy/recorda.so','--rpc-port','8899','--faucet-port','9900','--bind-address','127.0.0.1','--quiet'],{stdio:'inherit'});
let startupError;validator.on('error',e=>{startupError=e;});
const stop=()=>validator.kill('SIGINT');process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 const rpc=new Connection('http://127.0.0.1:8899','confirmed');let ready=false;
 for(let i=0;i<100;i++){if(startupError)throw startupError;if(validator.exitCode!==null)throw Error('Local validator exited');try{await rpc.getLatestBlockhash();ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!ready)throw Error('Local validator startup timed out');
 const seed=spawn(process.execPath,['--test','protocol-tests/bondops.test.mjs'],{stdio:'inherit',env:{...process.env,RECORDA_TEST_RPC:'http://127.0.0.1:8899',RECORDA_TEST_WALLET_OUTPUT:resolve(ledger,'test-authority.secret.json'),...(process.env.RECORDA_LOCAL_WALLET?{RECORDA_TEST_WALLET:process.env.RECORDA_LOCAL_WALLET}:{})}});
 const code=await new Promise((resolve,reject)=>{seed.once('error',reject);seed.once('exit',resolve);});if(code!==0)throw Error('Local BondOps fixture failed');
 console.log(`BondOps local validator ready: http://127.0.0.1:8899. Ledger: ${ledger}. Choose Solana program / Local validator in the frontend.`);
 await new Promise(resolve=>validator.once('exit',resolve));
}catch(error){stop();throw error;}
