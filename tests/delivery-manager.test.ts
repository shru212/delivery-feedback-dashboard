import test from 'node:test';
import assert from 'node:assert/strict';
import {assessDelivery,comparisonBaseline,comparisonWindow} from '../lib/delivery-manager.ts';
import {agentTasks} from '../lib/preferences.ts';
import {agentEvidenceSchema} from '../lib/report-schema.ts';
import type {Snapshot} from '../lib/health.ts';
// Synthetic test data only; these records are never saved to Jira or the dashboard.
const fixture=(id='now',fetchedAt='2026-09-11T03:30:00Z'):Snapshot=>({id,fetchedAt,source:'Synthetic test fixture',projects:[{key:'KAN',name:'Test Outside'},{key:'AUT',name:'Test Autopsy'},{key:'SMB',name:'Test Bread'}],issues:[{key:'KAN-900001',project:'KAN',summary:'Fixture',status:'To Do',category:'To Do',assignee:null,updated:'2026-09-10T03:00:00Z',created:'2026-09-10T03:00:00Z',description:'',type:'Task',due:null,links:[]}],sprints:[],sprintNote:'',warnings:[],assessment:''});
test('IST comparison windows handle UTC date boundaries',()=>{assert.deepEqual(comparisonWindow('2026-09-10T20:00:00Z',1),{start:'2026-09-09T18:30:00.000Z',end:'2026-09-10T18:30:00.000Z'});});
test('daily comparisons do not substitute old, same-day or different-scope snapshots',()=>{
 const current=fixture(),old=fixture('old','2026-09-09T03:30:00Z'),today=fixture('today','2026-09-11T02:30:00Z'),other={...fixture('other','2026-09-10T03:30:00Z'),projects:[]};
 assert.equal(comparisonBaseline(current,[old,today,other],1),undefined);
 const yesterday=fixture('yesterday','2026-09-10T03:30:00Z');assert.equal(comparisonBaseline(current,[old,yesterday],1)?.id,'yesterday');
 assert.equal(assessDelivery(current,[yesterday]).weekly,null);
});
test('missing agent evidence is unavailable, not an invented success',()=>{const r=assessDelivery(fixture());assert.equal(r.projects[0].agent.state,'Unavailable');assert.equal(r.projects[0].health,'Attention');assert.equal(r.projects[1].health,'Unknown');assert.equal(r.projects[0].pdlc.phase,'Not assessed');});
test('agent completion conflicts are surfaced without changing Jira',()=>{
 const s=fixture();s.agentEvidence=[{project:'KAN',taskId:agentTasks.KAN,checkedAt:'2026-09-11T03:20:00Z',sourceUpdatedAt:'2026-09-11T03:00:00Z',summary:'Reported completed',claims:[{key:'KAN-900001',completed:true}]}];
 const r=assessDelivery(s);assert.equal(r.projects[0].agent.state,'Current');assert.equal(r.projects[0].conflicts.length,1);assert.equal(s.issues[0].status,'To Do');assert(r.decisions.some(d=>d.kind==='Evidence conflict'));
 s.agentEvidence[0].sourceUpdatedAt='2026-09-01T00:00:00Z';assert.equal(assessDelivery(s).projects[0].agent.state,'Stale');
});
test('unverified dependencies never become confirmed open links',()=>{
 const s=fixture();s.issues[0].links=[{type:{inward:'is blocked by'},inwardIssue:{key:'AUT-900002'}}];
 let r=assessDelivery(s);assert.equal(r.dependencies[0].state,'Unverified');assert.equal(r.dependencies[0].crossProject,true);assert.equal(r.projects[0].health,'Attention');
 s.issues[0].links[0].inwardIssue.fields={status:{statusCategory:{name:'In Progress'}}};r=assessDelivery(s);assert.equal(r.projects[0].health,'At risk');
});
test('evidence contract rejects wrong tasks, duplicate projects and cross-project claims',()=>{
 const e={project:'KAN',taskId:agentTasks.KAN,checkedAt:'2026-09-10T03:20:00Z',sourceUpdatedAt:null,summary:'No update'};
 assert(agentEvidenceSchema.safeParse([e]).success);
 assert(!agentEvidenceSchema.safeParse([{...e,taskId:agentTasks.AUT}]).success);
 assert(!agentEvidenceSchema.safeParse([e,e]).success);
 assert(!agentEvidenceSchema.safeParse([{...e,claims:[{key:'AUT-1',completed:true}]}]).success);
});
