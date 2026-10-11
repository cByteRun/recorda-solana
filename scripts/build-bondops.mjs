import ts from 'typescript';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function buildBondOpsRuntime() {
 const root=fileURLToPath(new URL('../',import.meta.url)), out=resolve(root,'target/bondops-runtime');
 mkdirSync(resolve(out,'idl'),{recursive:true});
 for(const name of ['protocol','protocol-audit','actions-v2','governance','bondops-reader']) {
  let source=readFileSync(resolve(root,`src/shared/solana/${name}.${name==='bondops-reader'?'js':'ts'}`),'utf8');
  source=source.replace('@/shared/solana/idl/recorda.json','./idl/recorda.json').replace('import.meta.env?.VITE_RECORDA_PROGRAM_ID','process.env.BONDOPS_PROGRAM_ID');
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true}});
  const code=result.outputText.replace(/from (["'])(\.\/[\w-]+)\1/g,(_,quote,path)=>`from ${quote}${path}.js${quote}`);
  writeFileSync(resolve(out,`${name}.js`),code);
 }
 copyFileSync(resolve(root,'src/shared/solana/idl/recorda.json'),resolve(out,'idl/recorda.json'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))buildBondOpsRuntime();
