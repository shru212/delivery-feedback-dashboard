import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { defaults,settingsSchema,safeSettings,encrypt,decrypt,limitedJSON,assertOrigin,type Settings } from "@/lib/security";
import { requestJSON,jiraHeaders } from "@/lib/jira";
import { refreshPipeline } from "@/lib/pipeline";
import { assessDelivery } from '@/lib/delivery-manager';
import { snapshotHistory } from '@/lib/snapshot-store';
import {z} from 'zod';
import {defaultPreferences,preferenceSchema,agentTasks,latestSlot,nextSlot} from '@/lib/preferences';
import {snapshotSchema,agentEvidenceSchema} from '@/lib/report-schema';
import initialPresentation from '@/lib/steerco-baseline.json';
import {selectEdition,presentationResponse} from '@/lib/presentation-edition';
export const dynamic="force-dynamic";
const E=env as unknown as {DB:D1Database;VAULT_KEY:string;APP_ORIGIN:string};
function json(v:unknown,status=200){return Response.json(v,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});}
async function settings(owner:string):Promise<Settings>{const row=await E.DB.prepare("SELECT encrypted FROM integrations WHERE user_id = ?").bind(owner).first<{encrypted:string}>();return row?decrypt(row.encrypted,owner,E.VAULT_KEY):defaults;}
async function preferenceState(owner:string){
 const row=await E.DB.prepare('SELECT payload,revision,updated FROM preferences WHERE user_id=?').bind(owner).first<{payload:string;revision:number;updated:string}>();
 const preferences=row?preferenceSchema.parse(JSON.parse(row.payload)):defaultPreferences;
 const lastRun=await E.DB.prepare('SELECT slot,status,updated,detail FROM report_runs WHERE user_id=? ORDER BY slot DESC LIMIT 1').bind(owner).first();
 const check=await E.DB.prepare("SELECT updated FROM report_runs WHERE id=?").bind(owner+':check').first<{updated:string}>();
 const slot=latestSlot(preferences);
 const completed=slot?await E.DB.prepare("SELECT status,updated FROM report_runs WHERE id=?").bind(owner+':'+slot).first<{status:string;updated:string}>():null;
 // Never execute historical windows preceding the owner's most recent schedule change.
 const due=!!slot&&(!row||slot>=row.updated)&&(!completed||completed.status==='failed'||(completed.status==='running'&&Date.now()-Date.parse(completed.updated)>3600000));
 return {preferences,revision:row?.revision??0,agentTasks,runtime:{lastCheck:check?.updated??null,nextRun:nextSlot(preferences),lastRun},slot,due};
}
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to continue."},401);
 try{
  if(req.url.endsWith('/preferences')||req.url.endsWith('/schedule'))return json(await preferenceState(user.userId));
  if(new URL(req.url).pathname.endsWith('/presentation')){
   const requested=new URL(req.url).searchParams.get('snapshotId');
   const row=await E.DB.prepare('SELECT payload,snapshot_id FROM report_artifacts WHERE user_id=?').bind(user.userId).first<{payload:string;snapshot_id:string}>();
   const initial=initialPresentation as {base64:string;snapshotId?:string};
   const edition=selectEdition(row,initial,requested);
   if(!edition)return json({error:'This snapshot does not have a generated PowerPoint yet. The dashboard is current; an older deck will not be exported as this edition.'},409);
   return presentationResponse(edition);
  }
  if(req.url.endsWith("/settings")){if(!E.VAULT_KEY)return json({error:"Secure vault is not provisioned. Keys cannot be saved."},503);return json(safeSettings(await settings(user.userId)));}
  if(req.url.endsWith('/dashboard')||req.url.endsWith('/briefing')){
   const history=await snapshotHistory(E.DB,user.userId);
   const latest=history[0],state=await preferenceState(user.userId);
   const delivery=latest.delivery??assessDelivery(latest,history,state.preferences);
   if(req.url.endsWith('/briefing'))return json({snapshotId:latest.id,asOf:latest.fetchedAt,briefing:delivery.briefing,delivery});
   return json({snapshot:{...latest,delivery},history:history.map(s=>({id:s.id,fetchedAt:s.fetchedAt,source:s.source,issues:s.issues.length})),comparison:delivery.weekly,dailyComparison:delivery.daily});
  }
  return json({error:"Not found"},404);
 }catch{return json({error:"Storage is unavailable. The last saved report has not been changed."},503);}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to continue."},401);
 try{assertOrigin(req,E.APP_ORIGIN || (process.env.NODE_ENV==="development"?"http://localhost:5173":""));}catch{return json({error:"Request origin or content type rejected."},403);}
 const route=new URL(req.url).pathname.split("/").pop();
 let body:any;try{body=await limitedJSON(req,route==='ingest'||route==='presentation'?1500000:16384);}catch{return json({error:"Invalid or oversized request."},400);}
 try{
  if(route==='ingest'){
   const parsed=snapshotSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid snapshot, source timestamp, or project scope.'},400);
   const evidence=agentEvidenceSchema.safeParse(body.agentEvidence??[]);if(!evidence.success)return json({error:'Invalid project-agent evidence.'},400);
   const history=await snapshotHistory(E.DB,user.userId),state=await preferenceState(user.userId);
   const snapshot=await refreshPipeline(await settings(user.userId),user.userId,parsed.data,{history,preferences:state.preferences,agentEvidence:evidence.data});
   await E.DB.prepare('INSERT INTO snapshots(id,user_id,fetched_at,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(snapshot.id,user.userId,snapshot.fetchedAt,JSON.stringify(snapshot)).run();
   return json({ok:true,snapshotId:snapshot.id,warnings:snapshot.warnings});
  }
  if(route==='presentation'){
   const parsed=z.object({snapshotId:z.string().max(120),base64:z.string().max(1400000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict().safeParse(body);
   if(!parsed.success||!parsed.data.base64.startsWith('UEsDB'))return json({error:'Invalid presentation upload'},400);
   const d=parsed.data;const source=await E.DB.prepare('SELECT id FROM snapshots WHERE id=? AND user_id=?').bind(d.snapshotId,user.userId).first();
   if(!source)return json({error:'Save the source snapshot first.'},409);
   await E.DB.prepare('INSERT INTO report_artifacts(user_id,snapshot_id,payload,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET snapshot_id=excluded.snapshot_id,payload=excluded.payload,updated=excluded.updated').bind(user.userId,d.snapshotId,d.base64,new Date().toISOString()).run();
   return json({ok:true});
  }
  if(route==='preferences'){
   const parsed=z.object({preferences:preferenceSchema,revision:z.number().int().min(0)}).strict().safeParse(body);
   if(!parsed.success)return json({error:'Check agent names and schedule fields. Times must use whole hours in Asia/Kolkata.'},400);
   const {preferences,revision}=parsed.data;
   const result=revision===0?await E.DB.prepare('INSERT OR IGNORE INTO preferences(user_id,payload,revision,updated) VALUES(?,?,1,?)').bind(user.userId,JSON.stringify(preferences),new Date().toISOString()).run():await E.DB.prepare('UPDATE preferences SET payload=?,revision=revision+1,updated=? WHERE user_id=? AND revision=?').bind(JSON.stringify(preferences),new Date().toISOString(),user.userId,revision).run();
   if(!result.meta.changes)return json({error:'Preferences changed in another session. Reload before saving.'},409);
   return json(await preferenceState(user.userId));
  }
  if(route==='check'){
   await E.DB.prepare("INSERT INTO report_runs(id,user_id,slot,status,updated) VALUES(?,?,'','checked',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated").bind(user.userId+':check',user.userId,new Date().toISOString()).run();
   return json(await preferenceState(user.userId));
  }
  if(route==='claim'){
   const state=await preferenceState(user.userId);if(!state.due)return json({claimed:false,...state});
   const id=user.userId+':'+state.slot,now=new Date().toISOString(),stale=new Date(Date.now()-3600000).toISOString();
   const result=await E.DB.prepare("INSERT INTO report_runs(id,user_id,slot,status,updated) VALUES(?,?,?,'running',?) ON CONFLICT(id) DO UPDATE SET status='running',updated=excluded.updated WHERE report_runs.status='failed' OR (report_runs.status='running' AND report_runs.updated < ?)").bind(id,user.userId,state.slot,now,stale).run();
   return json({claimed:!!result.meta.changes,runId:id,...state});
  }
  if(route==='finish'){
   const parsed=z.object({runId:z.string().max(200),status:z.enum(['complete','failed']),detail:z.string().max(1000)}).strict().safeParse(body);
   if(!parsed.success)return json({error:'Invalid run result'},400);
   const d=parsed.data;const result=await E.DB.prepare("UPDATE report_runs SET status=?,detail=?,updated=? WHERE id=? AND user_id=? AND status='running'").bind(d.status,d.detail,new Date().toISOString(),d.runId,user.userId).run();
   return json({ok:!!result.meta.changes});
  }
  if(route==="settings"){
   if(!E.VAULT_KEY)return json({error:"Secure vault is not provisioned."},503);
   const parsed=settingsSchema.safeParse(body);if(!parsed.success)return json({error:"Check your email, provider hostname and field values."},400);
   const previous=await settings(user.userId);const s={...parsed.data};
   for(const key of ["jiraToken","mem0Key","pineconeKey"] as const)if(!s[key])s[key]=previous[key];
   await E.DB.prepare("INSERT INTO integrations(user_id,encrypted,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET encrypted=excluded.encrypted,updated=excluded.updated").bind(user.userId,await encrypt(s,user.userId,E.VAULT_KEY),new Date().toISOString()).run();
   return json({ok:true,...safeSettings(s)});
  }
  if(route==="disconnect"){
   if(!["jiraToken","mem0Key","pineconeKey"].includes(body.provider))return json({error:"Unknown provider"},400);
   const s=await settings(user.userId);delete s[body.provider as "jiraToken"|"mem0Key"|"pineconeKey"];
   await E.DB.prepare("UPDATE integrations SET encrypted=?,updated=? WHERE user_id=?").bind(await encrypt(s,user.userId,E.VAULT_KEY),new Date().toISOString(),user.userId).run();
   return json({ok:true,...safeSettings(s)});
  }
  if(route==='refresh'||route==='test'||route==='run-manager'){
   const input=route==='run-manager'?z.object({agentEvidence:agentEvidenceSchema}).strict().safeParse(body):null;
   if(input&&!input.success)return json({error:'Supply dated evidence for the configured project tasks only.'},400);
   const now=Date.now();
   const lock=await E.DB.prepare("INSERT INTO refresh_locks(user_id,until_ms) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET until_ms=excluded.until_ms WHERE refresh_locks.until_ms < ?").bind(user.userId,now+600000,now).run();
   if(!lock.meta.changes)return json({error:"A refresh or connection check is already running. Try again later."},429);
   try{
    const s=await settings(user.userId);
    if(route==="test"){
     if(!s.jiraToken||!s.jiraEmail)return json({error:"Save Jira credentials first."},400);
     await requestJSON(s.jiraSite+"/rest/api/3/myself",{headers:jiraHeaders(s)});
     return json({ok:true,message:"Jira authentication verified. Project coverage is checked during refresh."});
    }
    const history=await snapshotHistory(E.DB,user.userId),state=await preferenceState(user.userId);
    const snapshot=await refreshPipeline(s,user.userId,undefined,{history,preferences:state.preferences,agentEvidence:input?.success?input.data.agentEvidence:history[0]?.agentEvidence??[]});
    await E.DB.prepare("INSERT INTO snapshots(id,user_id,fetched_at,payload) VALUES(?,?,?,?)").bind(snapshot.id,user.userId,snapshot.fetchedAt,JSON.stringify(snapshot)).run();
    return json({ok:true,snapshot,briefing:snapshot.delivery?.briefing});
   }finally{await E.DB.prepare("UPDATE refresh_locks SET until_ms=? WHERE user_id=?").bind(Date.now()+15000,user.userId).run();}
  }
  return json({error:"Not found"},404);
 }catch{return json({error:"The operation could not complete. Check saved credentials and provider availability. No secret values were returned; the previous report is retained."},502);}
}
