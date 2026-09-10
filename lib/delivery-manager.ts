import {compare, risks, type Snapshot, type Issue} from './health.ts';
import {agentTasks, defaultPreferences, type Preferences} from './preferences.ts';

export type AgentEvidence={project:keyof typeof agentTasks;taskId:string;checkedAt:string;sourceUpdatedAt:string|null;summary:string;claims?:{key:string;status?:string;completed?:boolean}[]};
export type EvidenceRef=Pick<Issue,'key'|'status'|'assignee'|'updated'>;
export type Decision={kind:'Blocker'|'Quality'|'Ownership'|'Deadline'|'Dependency'|'Evidence conflict';text:string;evidence:EvidenceRef};
export type Dependency={from:string;to:string;project:string;targetProject:string;crossProject:boolean;state:'Open'|'Resolved'|'Unverified';evidence:EvidenceRef};
export type DeliveryReport={version:1;asOf:string;headline:string;daily:ReturnType<typeof compare>;weekly:ReturnType<typeof compare>;dependencies:Dependency[];decisions:Decision[];projects:{key:string;name:string;agentName:string;health:'At risk'|'Attention'|'No flagged risks'|'Unknown';total:number;done:number;agent:{state:'Current'|'Stale'|'Unavailable';summary:string;checkedAt:string|null;sourceUpdatedAt:string|null;taskId:string};conflicts:{key:string;reported:string;actual:EvidenceRef}[];risks:(EvidenceRef&{reasons:string[]})[];pdlc:{phase:string;gate:string;keys:string[];asOf:string|null}}[];briefing:string};
const ref=(i:Issue):EvidenceRef=>({key:i.key,status:i.status,assignee:i.assignee,updated:i.updated});
export const istDay=(date:string)=>new Date(Date.parse(date)+330*60000).toISOString().slice(0,10);
export function comparisonWindow(asOf:string,days:number){
 const day=istDay(new Date(Date.parse(asOf)-days*86400000).toISOString());
 const start=new Date(Date.parse(day+'T00:00:00+05:30')).toISOString();
 return {start,end:new Date(Date.parse(start)+86400000).toISOString()};
}
// Exact preceding IST calendar day/week. Never silently substitute an older day.
export function comparisonBaseline(current:Snapshot,history:Snapshot[],days:number){
 const {start,end}=comparisonWindow(current.fetchedAt,days);
 const scope=current.projects.map(p=>p.key).sort().join(',');
 return history.filter(s=>s.id!==current.id&&s.fetchedAt>=start&&s.fetchedAt<end&&s.projects.map(p=>p.key).sort().join(',')===scope)
 .sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt))[0];
}
export function assessDelivery(snapshot:Snapshot,history:Snapshot[]=[],prefs:Preferences=defaultPreferences):DeliveryReport{
 const allRisks=risks(snapshot),byKey=new Map(snapshot.issues.map(i=>[i.key,i])),now=Date.parse(snapshot.fetchedAt);
 const dependencies:Dependency[]=[];
 for(const i of snapshot.issues.filter(i=>i.category!=='Done'))for(const l of i.links){
  if(!l?.inwardIssue?.key||!/blocked by/i.test(l.type?.inward??''))continue;
  const target=byKey.get(l.inwardIssue.key),category=target?.category??l.inwardIssue.fields?.status?.statusCategory?.name;
  const to=l.inwardIssue.key;if(dependencies.some(d=>d.from===i.key&&d.to===to))continue;
  const targetProject=to.split('-')[0];dependencies.push({from:i.key,to,project:i.project,targetProject,crossProject:targetProject!==i.project,state:category?(category==='Done'?'Resolved':'Open'):'Unverified',evidence:ref(i)});
 }
 const decisions:Decision[]=[];
 for(const i of allRisks){
  if(i.reasons.includes('High-priority defect'))decisions.push({kind:'Quality',text:'Confirm a retest owner and deployed-version evidence before release approval.',evidence:ref(i)});
  if(i.reasons.includes('Explicit blocker'))decisions.push({kind:'Blocker',text:'Confirm an unblock action and accountable owner.',evidence:ref(i)});
  if(i.reasons.includes('Unassigned'))decisions.push({kind:'Ownership',text:'Assign an accountable owner before committing delivery.',evidence:ref(i)});
  if(i.reasons.includes('Overdue date'))decisions.push({kind:'Deadline',text:'Confirm the recovery plan or approve a revised commitment; do not silently move the due date.',evidence:ref(i)});
 }
 for(const d of dependencies.filter(d=>d.state!=='Resolved'))decisions.push({kind:'Dependency',text:`${d.from} is blocked by ${d.to}: ${d.state==='Open'?'confirm ownership and sequencing':'verify the linked issue status'}.`,evidence:d.evidence});
 const projects=snapshot.projects.map(p=>{
  const items=snapshot.issues.filter(i=>i.project===p.key),projectRisks=allRisks.filter(i=>i.project===p.key);
  const taskId=agentTasks[p.key as keyof typeof agentTasks];
  const evidence=snapshot.agentEvidence?.find(e=>e.project===p.key&&e.taskId===taskId);
  const age=evidence?.sourceUpdatedAt?now-Date.parse(evidence.sourceUpdatedAt):Infinity;
  const checked=evidence?now-Date.parse(evidence.checkedAt):Infinity;
  const state: 'Current'|'Stale'|'Unavailable'=!evidence||!evidence.sourceUpdatedAt?'Unavailable':age>=0&&age<=86400000&&checked>=0&&checked<=86400000?'Current':'Stale';
  const conflicts=(evidence?.claims??[]).flatMap(c=>{
   const actual=byKey.get(c.key);if(!actual||actual.project!==p.key)return [];
   const mismatch=(c.status!==undefined&&c.status!==actual.status)||(c.completed!==undefined&&c.completed!==(actual.category==='Done'));
   return mismatch?[{key:c.key,reported:c.status??(c.completed?'Completed':'Not completed'),actual:ref(actual)}]:[];
  });
  for(const c of conflicts)decisions.push({kind:'Evidence conflict',text:`Agent reported ${c.reported}; Jira says ${c.actual.status}. Verify acceptance evidence; Jira remains the current status.`,evidence:c.actual});
  const severe=projectRisks.some(i=>i.reasons.some(r=>['Explicit blocker','Overdue date','High-priority defect'].includes(r)))||dependencies.some(d=>d.project===p.key&&d.state==='Open');
  const health:DeliveryReport['projects'][number]['health']=!items.length?'Unknown':severe?'At risk':projectRisks.length||conflicts.length||state!=='Current'?'Attention':'No flagged risks';
  const assessment=snapshot.projectAssessments?.[p.key];
  return {key:p.key,name:p.name,agentName:prefs.agents[p.key as keyof typeof prefs.agents]??p.key,health,total:items.length,done:items.filter(i=>i.category==='Done').length,
   agent:{state,summary:evidence?.summary??'No project-agent evidence has been collected.',checkedAt:evidence?.checkedAt??null,sourceUpdatedAt:evidence?.sourceUpdatedAt??null,taskId:taskId??''},conflicts,
   risks:projectRisks.map(i=>({...ref(i),reasons:i.reasons})),pdlc:assessment?{...assessment,keys:assessment.keys.filter(k=>byKey.get(k)?.project===p.key),asOf:snapshot.fetchedAt}:{phase:'Not assessed',gate:'Obtain dated PDLC gate evidence and owner acceptance.',keys:[],asOf:null}};
 });
 const daily=compare(snapshot,comparisonBaseline(snapshot,history,1)),weekly=compare(snapshot,comparisonBaseline(snapshot,history,7));
 const headline=projects.map(p=>`${p.name}: ${p.health}`).join(' · ');
 const detail=(e:EvidenceRef)=>`${e.key} · ${e.status} · ${e.assignee??'Unassigned'} · updated ${e.updated}`;
 const briefing=[`Delivery briefing — ${snapshot.fetchedAt}`,headline,'Assessment is rule-based; issue counts are not percent complete.',...projects.map(p=>`${p.agentName} / ${p.key}: ${p.done} Done of ${p.total} records; agent evidence ${p.agent.state.toLowerCase()}.`),daily?`Since ${daily.since}: ${daily.changes.length} status/owner changes, ${daily.added.length} newly visible, ${daily.noLongerVisible.length} no longer visible.`:'Daily comparison unavailable: no same-scope snapshot on the previous IST calendar day.',weekly?`Since ${weekly.since}: ${weekly.recurring.length} recurring issue risks. This is not proof of multi-sprint blockage.`:'Weekly comparison unavailable: no same-scope snapshot seven IST calendar days earlier.','Decisions (PM assessment):',...decisions.slice(0,12).map(d=>`${d.kind}: ${d.text} ${detail(d.evidence)}`),...(decisions.length>12?[`${decisions.length-12} further decisions in the dashboard.`]:[])].join('\n');
 return {version:1,asOf:snapshot.fetchedAt,headline,daily,weekly,dependencies,decisions,projects,briefing};
}
