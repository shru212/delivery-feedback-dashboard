export type Issue={key:string;project:string;summary:string;status:string;category:string;assignee:string|null;updated:string;created:string;type:string;priority?:string;description:string;due:string|null;links:any[];flagged?:boolean};
export type Snapshot={id:string;fetchedAt:string;source:string;projects:{key:string;name:string}[];issues:Issue[];sprints:any[];sprintNote:string;warnings:string[];assessment:string;memory?:any;projectAssessments?:Record<string,{phase:string;gate:string;keys:string[]}>;agentEvidence?:import('./delivery-manager').AgentEvidence[];delivery?:import('./delivery-manager').DeliveryReport};
export function risks(s:Snapshot){
 const now=new Date(s.fetchedAt).getTime();
 return s.issues.filter(i=>i.category!=="Done").map(i=>{
 const reasons:string[]=[];
 if(/blocked|impediment/i.test(i.status)||i.flagged)reasons.push("Explicit blocker");
 if(/bug/i.test(i.type)&&/^(high|highest|critical)$/i.test(i.priority??''))reasons.push('High-priority defect');
 if(i.due&&new Date(i.due+"T23:59:59Z").getTime()<now)reasons.push("Overdue date");
 if(!i.assignee)reasons.push("Unassigned");
 if(now-new Date(i.updated).getTime()>7*86400000)reasons.push("No update in 7+ days");
 if(i.links.some(l=>l.inwardIssue&&/blocked by/i.test(l.type?.inward??"")&&l.inwardIssue.fields?.status?.statusCategory?.name&&l.inwardIssue.fields.status.statusCategory.name!=="Done"))reasons.push("Open dependency");
 return {...i,reasons};
 }).filter(i=>i.reasons.length).sort((a,b)=>b.reasons.length-a.reasons.length);
}
export function compare(current:Snapshot,previous?:Snapshot){
 if(!previous)return null;
 const before=new Map(previous.issues.map(i=>[i.key,i]));
 const currentKeys=new Set(current.issues.map(i=>i.key));
 return {since:previous.fetchedAt,added:current.issues.filter(i=>!before.has(i.key)).map(i=>i.key),
 noLongerVisible:previous.issues.filter(i=>!currentKeys.has(i.key)).map(i=>i.key),
 changes:current.issues.filter(i=>before.has(i.key)&&(before.get(i.key)!.status!==i.status||before.get(i.key)!.assignee!==i.assignee)).map(i=>({key:i.key,from:before.get(i.key)!.status,to:i.status,previousAssignee:before.get(i.key)!.assignee,assignee:i.assignee})),
 recurring:risks(current).filter(i=>risks(previous).some(p=>p.key===i.key&&p.reasons.some(r=>i.reasons.includes(r)))).map(i=>i.key)};
}
