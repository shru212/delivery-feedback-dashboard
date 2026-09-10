import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { fetchJira,requestJSON } from "./jira.ts";
import { risks,type Snapshot } from "./health.ts";
import type { Settings } from "./security";
import {assessDelivery, type AgentEvidence} from './delivery-manager.ts';
import {defaultPreferences, type Preferences} from './preferences.ts';
export type ManagerContext={history?:Snapshot[];preferences?:Preferences;agentEvidence?:AgentEvidence[]};
export async function refreshPipeline(s:Settings,owner:string,provided?:Snapshot,context:ManagerContext={}){
 const scope="delivery-"+await digest(owner);
 const chain=RunnableSequence.from([
  RunnableLambda.from(async()=>structuredClone(provided??await fetchJira(s))),
  RunnableLambda.from(async(snapshot:Snapshot)=>{
   snapshot.agentEvidence=context.agentEvidence??snapshot.agentEvidence??[];
   snapshot.delivery=assessDelivery(snapshot,context.history??[],context.preferences??defaultPreferences);
   snapshot.assessment=snapshot.delivery.headline;
   return snapshot;
  }),
  RunnableLambda.from(async(snapshot:Snapshot)=>{
   if(!s.memoryConsent){snapshot.memory={status:"Disabled — consent not granted"};return snapshot;}
   const text=JSON.stringify({asOf:snapshot.fetchedAt,assessment:snapshot.assessment,decisions:snapshot.delivery?.decisions.slice(0,30).map(d=>({kind:d.kind,key:d.evidence.key,text:d.text})),risks:risks(snapshot).slice(0,30).map(i=>({key:i.key,status:i.status,updated:i.updated,reasons:i.reasons})),projects:snapshot.projects.map(p=>({key:p.key,issues:snapshot.issues.filter(i=>i.project===p.key).length}))});
   const memory:any={status:"Attempted",mem0:"Not configured",pinecone:"Not configured"};
   if(s.mem0Key){
    const headers={Authorization:"Token "+s.mem0Key,"Content-Type":"application/json"};
    try{
     const history=await requestJSON("https://api.mem0.ai/v3/memories/search/",{method:"POST",headers,body:JSON.stringify({query:"Prior delivery risks and decisions",filters:{user_id:scope},top_k:5})});
     memory.mem0History=(history.results??[]).map((r:any)=>({text:r.memory,created:r.created_at})).slice(0,5);
     const result=await requestJSON("https://api.mem0.ai/v3/memories/add/",{method:"POST",headers,body:JSON.stringify({messages:[{role:"user",content:text}],user_id:scope,metadata:{snapshot_id:snapshot.id,as_of:snapshot.fetchedAt}})});
     memory.mem0=result.status==="PENDING"?"Accepted; processing pending":"Request accepted";
    }catch{memory.mem0="Unavailable — Jira snapshot preserved";snapshot.warnings.push("Mem0 retrieval or write failed. No memory completion is claimed.");}
   }
   if(s.pineconeKey&&s.pineconeHost){
    const base="https://"+s.pineconeHost+"/records/namespaces/"+scope;
    const headers={"Api-Key":s.pineconeKey,"X-Pinecone-Api-Version":"2025-10","Content-Type":"application/json"};
    try{
     const history=await requestJSON(base+"/search",{method:"POST",headers,body:JSON.stringify({query:{inputs:{text:"Prior delivery risks and decisions"},top_k:5},fields:["chunk_text","as_of"]})});
     memory.pineconeHistory=(history.result?.hits??[]).map((h:any)=>({text:h.fields?.chunk_text,created:h.fields?.as_of}));
     await requestJSON(base+"/upsert",{method:"POST",headers:{...headers,"Content-Type":"application/x-ndjson"},body:JSON.stringify({_id:snapshot.id,chunk_text:text,as_of:snapshot.fetchedAt})+"\n"});
     memory.pinecone="Snapshot indexed";
    }catch{memory.pinecone="Unavailable — Jira snapshot preserved";snapshot.warnings.push("Pinecone retrieval or write failed. Verify integrated embeddings and chunk_text field mapping.");}
   }
   snapshot.memory=memory;return snapshot;
  }),
  RunnableLambda.from(async(snapshot:Snapshot)=>{
   if(snapshot.delivery)snapshot.delivery.briefing+='\nHistorical context: '+(snapshot.memory?.status==='Disabled — consent not granted'?'not shared (consent disabled).':`Mem0: ${snapshot.memory?.mem0}; Pinecone: ${snapshot.memory?.pinecone}. Retrieved notes remain historical, not current Jira facts.`);
   return snapshot;
  })
 ]);
 // No tracing callbacks, tool execution from issue text, or credentials in chain inputs.
 return await chain.invoke({});
}
async function digest(owner:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(owner)))).map(b=>b.toString(16).padStart(2,"0")).join("");}
