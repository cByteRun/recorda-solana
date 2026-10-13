import { createServer } from 'node:http';
import { createBondOps, configFromEnv } from '../server/bondops/service.mjs';
import { buildBondOpsRuntime } from './build-bondops.mjs';
buildBondOpsRuntime();
const backend=createBondOps(configFromEnv()),port=Number(process.env.BONDOPS_PORT??4445);
const server=createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413);res.end();return;}chunks.push(chunk);}const response=await backend.handle(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch{res.writeHead(500);res.end();}});
server.listen(port,'127.0.0.1',()=>console.log(`BondOps API http://127.0.0.1:${port}/api/bondops`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{backend.close();process.exit(0);}));
