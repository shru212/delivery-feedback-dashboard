import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshPipeline} from '../lib/pipeline.ts';
import {defaults} from '../lib/security.ts';
import type {Snapshot} from '../lib/health.ts';
const sample:Snapshot={id:'synthetic-pipeline',fetchedAt:'2026-09-11T03:30:00Z',source:'Synthetic fixture',projects:[{key:'KAN',name:'Test'}],issues:[{key:'KAN-900001',project:'KAN',summary:'Fixture',status:'To Do',category:'To Do',assignee:'Private fixture name',updated:'2026-09-10T03:30:00Z',created:'2026-09-10T03:30:00Z',description:'Private fixture description',type:'Task',due:null,links:[]}],sprints:[],sprintNote:'',warnings:[],assessment:''};
test('LangChain produces a briefing with zero network calls when consent is off and Jira is supplied',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected network');};
 try{const result=await refreshPipeline(defaults,'synthetic-owner',sample);assert.equal(calls,0);assert(result.delivery?.briefing.includes('Daily comparison unavailable'));assert.equal(result.delivery?.projects[0].health,'Attention');assert.equal(sample.delivery,undefined);}finally{globalThis.fetch=original;}
});
test('memory receives bounded summaries, uses owner namespaces and cannot overwrite current status',async()=>{
 const original=globalThis.fetch;const calls:{url:string;body:any}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify(String(url).includes('/search')?{results:[{memory:'Historical: done',created_at:'2026-09-01'}],result:{hits:[]}}:{status:'PENDING'}),{status:200});};
 try{
  const s={...defaults,memoryConsent:true,mem0Key:'fixture-key',pineconeKey:'fixture-key',pineconeHost:'fixture.svc.test.pinecone.io'};
  const result=await refreshPipeline(s,'owner-a',sample);assert.equal(calls.length,4);assert.equal(result.issues[0].status,'To Do');assert.equal(result.memory.mem0,'Accepted; processing pending');
  const bodies=JSON.stringify(calls);assert(!bodies.includes('Private fixture'));assert(!bodies.includes('fixture-key'));assert(!bodies.includes('owner-a'));
  const scope=calls[0].body.filters.user_id;calls.length=0;await refreshPipeline(s,'owner-b',sample);assert.notEqual(calls[0].body.filters.user_id,scope);
 }finally{globalThis.fetch=original;}
});
test('provider failure retains the fresh Jira evidence and delivery assessment',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:503});
 try{const result=await refreshPipeline({...defaults,memoryConsent:true,mem0Key:'fixture-key'},'owner',sample);assert.equal(result.issues[0].status,'To Do');assert(result.delivery);assert(result.warnings.some(w=>w.includes('Mem0')));}finally{globalThis.fetch=original;}
});
