import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {solanaTool} from './solana-tools.mjs';
const child=spawn(solanaTool('cargo-build-sbf'),['--manifest-path','programs/recorda/Cargo.toml','--','--locked']);
let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output+=data;process.stdout.write(data);});
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
// Some SBF toolchains print stack-overflow diagnostics while returning success.
const unsafeStack=/Stack offset .*exceeded|max(?:imum)? stack.*exceeded|stack frame.*exceeds/i.test(output);
if(code!==0||unsafeStack){console.error('SBF acceptance failed: build error or unsafe stack diagnostic');process.exitCode=code||1;}
else{mkdirSync('target/security-audit',{recursive:true});writeFileSync('target/security-audit/sbf.json',JSON.stringify({passed:true,at:new Date().toISOString(),sha256:createHash('sha256').update(readFileSync('target/deploy/recorda.so')).digest('hex')},null,2));}
