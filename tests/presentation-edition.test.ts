import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {selectEdition,presentationResponse} from '../lib/presentation-edition.ts';
test('matching the requested snapshot takes precedence over a different saved edition',()=>{
 const current={snapshotId:'current',base64:'UEs='},old={snapshot_id:'old',payload:'UEs='};
 assert.equal(selectEdition(old,current,'current'),current);
 assert.equal(selectEdition(old,current,'missing'),null);
 assert.equal(selectEdition(old,current,'old')?.snapshotId,'old');
});
test('response carries the exact validated PowerPoint bytes and snapshot identity',async()=>{
 const edition=JSON.parse(await fs.readFile(new URL('../lib/steerco-baseline.json',import.meta.url),'utf8'));
 const snapshot=JSON.parse(await fs.readFile(new URL('../lib/baseline.json',import.meta.url),'utf8'));
 assert.equal(edition.snapshotId,snapshot.id);
 const response=presentationResponse(edition);
 assert.equal(response.headers.get('x-snapshot-id'),snapshot.id);
 assert(response.headers.get('content-type')?.includes('presentationml'));
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(edition.base64,'base64'));
});
