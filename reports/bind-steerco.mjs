// Bind a verified generated presentation to its exact dashboard snapshot.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const [deckPath,snapshotPath]=process.argv.slice(2);
if(!deckPath||!snapshotPath)throw Error('Provide a validated PPTX and its source snapshot.');
const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
const base64=(await fs.readFile(deckPath)).toString('base64');
await fs.writeFile(root+'/lib/steerco-baseline.json',JSON.stringify({snapshotId:snapshot.id,fetchedAt:snapshot.fetchedAt,base64}));
console.log(JSON.stringify({snapshotId:snapshot.id,bytes:base64.length}));
