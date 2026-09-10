import {risks,type Snapshot,type Issue} from './health.ts';
import {defaultPreferences,type Preferences} from './preferences.ts';
export type BoardRisk={id:string;title:string;level:'Escalate'|'Decision needed';kind:'Delivery'|'Planning gap';impact:string;action:string;owner:string;decisionBy:string;evidence:Issue[]};
export function steercoModel(s:Snapshot,prefs:Preferences=defaultPreferences){
 const open=s.issues.filter(i=>i.category!=='Done'),signals=risks(s);
 const defects=open.filter(i=>/bug/i.test(i.type)&&/^(high|highest|critical)$/i.test(i.priority??''));
 const owners=open.filter(i=>!i.assignee);
 const gates=['KAN-18','AUT-13','SMB-19'].map(k=>open.find(i=>i.key===k)).filter((i):i is Issue=>!!i);
 const blocking=signals.filter(i=>i.reasons.some(r=>['Explicit blocker','Overdue date','Open dependency'].includes(r)));
 const stale=signals.filter(i=>i.reasons.includes('No update in 7+ days'));
 const register:BoardRisk[]=[];
 const add=(id:string,title:string,evidence:Issue[],impact:string,action:string,level:BoardRisk['level']='Decision needed')=>{if(evidence.length)register.push({id,title,evidence,impact,action,level,kind:'Delivery',owner:'Risk owner unconfirmed. Jira assignees: '+[...new Set(evidence.map(i=>i.assignee??'Unassigned'))].join(', '),decisionBy:'Before the next delivery commitment'});};
 add('quality','High-priority defects remain open',defects,'Release readiness is uncertain until the team verifies the fixes.','Assign a retest owner and review deployed-version evidence.','Escalate');
 add('blocking','Blocking or overdue work needs intervention',blocking,'Dependent work or a recorded due date needs a recovery decision.','Agree the unblock action, owner and recovery date.','Escalate');
 add('ownership','Open work has no accountable owner',owners,'Unowned work cannot support a credible delivery forecast.','Name accountable owners and confirm capacity before committing.');
 add('gates','Scope and release gates need approval',gates,'Discovery exit or release readiness remains unresolved.','Record the gate decision and required acceptance evidence.');
 add('stale','Delivery evidence needs an update',stale,'Old updates may conceal a changed delivery position.','Request dated progress and blocker updates.');
 const planning:BoardRisk[]=[
  {id:'budget',title:'Budget baseline unavailable',level:'Decision needed',kind:'Planning gap',impact:'The board cannot compare actual spend, remaining cost and approved funding from this dataset.',action:'Request approved budget, actual spend, forecast-to-complete and contingency.',owner:'Unassigned; proposed role: finance lead',decisionBy:'Before a funding decision',evidence:open.filter(i=>i.key==='AUT-7')},
  {id:'capacity',title:'Capacity plan unavailable',level:'Decision needed',kind:'Planning gap',impact:'Parallel project commitments have no validated staffing or allocation baseline in the connected data.',action:'Confirm available people, allocation, leave and competing work.',owner:'Unassigned; proposed role: engineering lead',decisionBy:'Before agreeing scope and dates',evidence:[]},
  {id:'board',title:'Board approval pack incomplete',level:'Decision needed',kind:'Planning gap',impact:'A consolidated benefits baseline, milestone forecast and named approval owner are not available in this reporting model.',action:'Assemble the business case, gate evidence and explicit go/no-go asks.',owner:'Unassigned; proposed role: program sponsor',decisionBy:'Before the board meeting',evidence:gates}
 ];
 const projects=s.projects.map(p=>{
  const items=s.issues.filter(i=>i.project===p.key),done=items.filter(i=>i.category==='Done').length,active=items.filter(i=>i.category==='In Progress').length;
  const high=defects.filter(i=>i.project===p.key),attention=signals.filter(i=>i.project===p.key);
  const gate=gates.find(i=>i.project===p.key),agent=s.delivery?.projects.find(i=>i.key===p.key)?.agent;
  const level=!items.length?'Unknown':high.length||blocking.some(i=>i.project===p.key)?'Escalate':attention.length||gate||agent?.state!=='Current'?'Decision needed':'No flagged risk';
  return {...p,agent:prefs.agents[p.key as keyof Preferences['agents']]??p.key,level,done,active,remaining:items.length-done-active,total:items.length,high:high.length,unassigned:items.filter(i=>i.category!=='Done'&&!i.assignee).length,riskCount:attention.length,evidence:high.length?high:gate?[gate]:attention.slice(0,2),gate,agentState:agent?.state??'Unavailable'};
 });
 const trades=[
  {id:'scope',title:'Scope vs. release timing',question:'What can enter the next release?',a:{title:'Approve a narrower scope',gain:'Fewer features to validate',cost:'Deferred user value and follow-up work'},b:{title:'Retain the full scope',gain:'Preserves intended functionality',cost:'More validation effort and schedule exposure'},recommendation:'Review a narrower scope only after the owner accepts the exclusions and safety gates.',evidence:gates},
  {id:'funding',title:'Parallel delivery vs. funding exposure',question:'How much work should run at once?',a:{title:'Sequence the projects',gain:'Concentrates scarce capacity',cost:'Later starts for lower-priority work'},b:{title:'Fund parallel streams',gain:'Can reduce sequencing delays',cost:'Needs a funded capacity plan and coordination'},recommendation:'Confirm cost and capacity before approving parallel commitments.',evidence:planning[0].evidence},
  {id:'quality',title:'Release speed vs. verification',question:'What evidence is necessary for go/no-go?',a:{title:'Complete focused retests first',gain:'Reduces uncertainty around open defects',cost:'Consumes time before release'},b:{title:'Exclude affected capabilities',gain:'May preserve a smaller release window',cost:'Requires safe isolation and explicit scope approval'},recommendation:'Use dated acceptance evidence. Do not treat committed fixes as verified deployment.',evidence:defects}
 ];
 return {snapshotId:s.id,asOf:s.fetchedAt,projects,risks:register,planning,trades,highDefects:defects.length,unassigned:owners.length,issueSignals:signals.length,decisions:[...register,...planning],agenda:['Portfolio pulse','Delivery risks','Budget & board gaps','Decisions pending','Trade-offs']};
}
export type SteercoModel=ReturnType<typeof steercoModel>;
