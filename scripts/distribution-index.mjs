import {readFileSync,writeFileSync} from 'node:fs';
import {replayIndex,buildManifest,persistManifest,canonical} from './lib/distribution.mjs';
const [journalPath,parametersPath,archiveDirectory]=process.argv.slice(2);
if(!journalPath||!parametersPath||!archiveDirectory)throw Error('Usage: node scripts/distribution-index.mjs finalized-journal.json parameters.json archive-directory');
const journal=JSON.parse(readFileSync(journalPath)),parameters=JSON.parse(readFileSync(parametersPath));
const index=replayIndex(journal,journal.bank.slot,parameters.archiveProvider),manifest=buildManifest(index,parameters),stored=persistManifest(archiveDirectory,manifest);
writeFileSync(`${archiveDirectory}/index.json`,canonical(index)+'\n');console.log(JSON.stringify({recordSlot:index.recordSlot,supply:index.supply,total:manifest.total,...stored}));
