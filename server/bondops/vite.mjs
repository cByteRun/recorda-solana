import { loadEnv } from 'vite';
import { createBondOps, configFromEnv } from './service.mjs';
export function bondOpsPlugin(){return {name:'recorda-bondops-api',configureServer(server){
 const backend=createBondOps(configFromEnv({...loadEnv(server.config.mode,server.config.envDir,''),...process.env}));
 server.httpServer?.once('close',()=>backend.close());
 server.middlewares.use('/api/bondops',async(req,res)=>{
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){res.statusCode=413;res.end(JSON.stringify({error:'Request too large'}));return;}chunks.push(chunk);}
   const port=server.config.server.port??4444;
   const request=new Request(`http://127.0.0.1:${port}/api/bondops${req.url??''}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
   const response=await backend.handle(request);res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());
  }catch{res.statusCode=500;res.end(JSON.stringify({error:'BondOps API unavailable'}));}
 });
}};}
