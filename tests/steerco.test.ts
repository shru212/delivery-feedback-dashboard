import test from 'node:test';
import assert from 'node:assert/strict';
import {steercoModel} from '../lib/steerco.ts';
import type {Snapshot} from '../lib/health.ts';
// Synthetic fixture, never persisted to the dashboard or Jira.
const sample:Snapshot={id:'fixture',fetchedAt:'2026-09-11T00:00:00Z',source:'Fixture',projects:[{key:'SMB',name:'Test Bread'}],issues:[{key:'SMB-9001',project:'SMB',summary:'Synthetic high bug',status:'To Do',category:'To Do',assignee:null,updated:'2026-09-10T23:00:00Z',created:'2026-09-10T23:00:00Z',type:'Bug',priority:'High',description:'',due:null,links:[]}],sprints:[],sprintNote:'',warnings:[],assessment:''};
test('SteerCo highlights high-priority defects even without an explicit blocked status',()=>{const m=steercoModel(sample);assert.equal(m.highDefects,1);assert.equal(m.projects[0].level,'Escalate');assert.equal(m.risks[0].id,'quality');assert.equal(m.unassigned,1);});
test('planning gaps are distinct from known delivery defects and cannot imply an overrun',()=>{const m=steercoModel(sample);assert.equal(m.planning.length,3);assert(m.planning.every(r=>r.kind==='Planning gap'));assert.equal(m.planning[0].title,'Budget baseline unavailable');assert(m.planning[0].owner.startsWith('Unassigned'));assert.equal(m.trades.length,3);});
test('closed defects do not remain open risks and chart parts sum to the record count',()=>{const m=steercoModel({...sample,issues:[{...sample.issues[0],status:'Done',category:'Done'}]});assert.equal(m.highDefects,0);assert.equal(m.risks.some(r=>r.id==='quality'),false);assert.equal(m.projects[0].done+m.projects[0].active+m.projects[0].remaining,m.projects[0].total);});
