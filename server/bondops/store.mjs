import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export class BondOpsStore {
 constructor(path) {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)');
 }
 read(id){const row=this.db.prepare('SELECT revision,payload FROM workspaces WHERE id=?').get(id);return row?{...JSON.parse(row.payload),revision:row.revision}:null;}
 initialize(id,initial){this.db.prepare('INSERT OR IGNORE INTO workspaces(id,revision,payload) VALUES(?,0,?)').run(id,JSON.stringify(initial));}
 update(id,fn){return this.updateMany([id],states=>fn(states[id]));}
 updateMany(ids,fn){this.db.exec('BEGIN IMMEDIATE');try{const states=Object.fromEntries(ids.map(id=>[id,this.read(id)]));if(ids.some(id=>!states[id]))throw Error('Workspace unavailable');const result=fn(states);for(const id of ids)this.db.prepare('UPDATE workspaces SET payload=?,revision=revision+1 WHERE id=?').run(JSON.stringify(states[id]),id);this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}

 close(){this.db.close();}
}
