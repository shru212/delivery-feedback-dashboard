import {test} from "node:test";
import assert from "node:assert/strict";
import {encrypt,decrypt,assertOrigin,settingsSchema,safeSettings,limitedJSON} from "../lib/security.ts";
import {compare,risks,type Snapshot} from "../lib/health.ts";
test("vault encryption is randomized, authenticated and owner-bound",async()=>{
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const s={jiraToken:"test-not-a-real-token"};
 const a=await encrypt(s,"owner-a",key),b=await encrypt(s,"owner-a",key);
 assert.notEqual(a,b);assert(!a.includes(s.jiraToken));assert.deepEqual(await decrypt(a,"owner-a",key),s);
 await assert.rejects(decrypt(a,"owner-b",key));
 const box=JSON.parse(a);box.data="AAAA"+box.data.slice(4);await assert.rejects(decrypt(JSON.stringify(box),"owner-a",key));
});
test("secret fields never appear in settings responses",()=>{const v=safeSettings({...settingsSchema.parse({}),jiraToken:"secret",mem0Key:"another",pineconeKey:"third"});assert.equal(JSON.stringify(v).includes("secret"),false);assert.equal(v.jiraConfigured,true);});
test("reject cross-origin writes and untrusted provider URLs",()=>{
 assert.throws(()=>assertOrigin(new Request("https://site.test/api/settings",{headers:{origin:"https://evil.test","content-type":"application/json"}}),"https://site.test"));
 assert.throws(()=>assertOrigin(new Request("https://site.test/api/settings",{headers:{"content-type":"application/json"}}),"https://site.test"));
 assertOrigin(new Request("https://site.test/api/settings",{headers:{origin:"https://site.test","content-type":"application/json"}}),"https://site.test");
 for(const host of ["127.0.0.1","https://good.svc.region.pinecone.io","good.svc.region.pinecone.io.evil.test","good.svc.region.pinecone.io/path"]){assert.equal(settingsSchema.safeParse({pineconeHost:host}).success,false);}
 assert.equal(settingsSchema.safeParse({pineconeHost:"delivery-123.svc.aped-4627-b74a.pinecone.io"}).success,true);
 assert.equal(settingsSchema.safeParse({jiraSite:"https://evil.test"}).success,false);
});
test("reject oversized request streams",async()=>{await assert.rejects(limitedJSON(new Request("https://site.test",{method:"POST",body:JSON.stringify({x:"a".repeat(17000)})})));});
const sample:Snapshot={id:"one",fetchedAt:"2026-09-11T00:00:00Z",source:"test",projects:[],issues:[{key:"TEST-1",project:"TEST",summary:"Test fixture",status:"To Do",category:"To Do",assignee:null,updated:"2026-09-10T00:00:00Z",created:"2026-09-10T00:00:00Z",type:"Task",description:"",due:null,links:[]}],sprints:[],sprintNote:"",warnings:[],assessment:""};
test("newly created unassigned issues are not mislabeled stale or blocked",()=>{assert.deepEqual(risks(sample)[0].reasons,["Unassigned"]);});
test("missing issues are not reported as completed",()=>{const result=compare({...sample,issues:[]},sample)!;assert.deepEqual(result.noLongerVisible,["TEST-1"]);assert.deepEqual(result.changes,[]);});
test("no baseline means no invented trend",()=>{assert.equal(compare(sample),null);});
