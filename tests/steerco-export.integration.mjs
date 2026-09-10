// Local-only auth-boundary check. Untrusted identity headers must not grant access.
import assert from 'node:assert/strict';
const base='http://localhost:5173';
const identity={'oai-authenticated-user-id':'local-steerco-export-fixture','oai-authenticated-user-email':'fixture@example.test'};
let r=await fetch(base+'/api/presentation?snapshotId=fixture');
assert.equal(r.status,401);
r=await fetch(base+'/api/presentation?snapshotId=fixture',{headers:identity});
assert.equal(r.status,401);
console.log('Local auth boundary passed: missing identity and untrusted supplied identity both rejected. Authenticated browser export not exercised by this check.');
