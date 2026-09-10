import type { Settings } from "./security";
import type { Snapshot,Issue } from "./health";
export async function requestJSON(url:string,init:RequestInit={}){
 const r=await fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error("Provider returned HTTP "+r.status);
 if(r.status===204)return {};
 const text=await r.text();return text?JSON.parse(text):{};
}
export function jiraHeaders(s:Settings){return {Authorization:"Basic "+btoa(s.jiraEmail+":"+s.jiraToken),Accept:"application/json","Content-Type":"application/json"};}
export async function fetchJira(s:Settings):Promise<Snapshot>{
 if(!s.jiraToken||!s.jiraEmail)throw new Error("Configure Jira before refreshing.");
 const headers=jiraHeaders(s),base=s.jiraSite;
 async function pages(path:string){let startAt=0,out:any[]=[];for(let n=0;n<100;n++){const d=await requestJSON(base+path+(path.includes("?")?"&":"?")+"startAt="+startAt+"&maxResults=100",{headers});out.push(...(d.values??[]));if(d.isLast===true||(d.total!==undefined&&out.length>=d.total)||!d.values?.length)return out;startAt+=d.values.length;}throw new Error("Project or board pagination limit reached; previous snapshot retained.");}
 const wanted=['AUT','KAN','SMB'];
 const projects=(await pages("/rest/api/3/project/search")).filter(p=>wanted.includes(p.key)).map(p=>({key:p.key,name:p.name}));
 if(projects.length!==3)throw new Error('All three configured projects must be accessible; previous snapshot retained.');
 const meta=await requestJSON(base+"/rest/api/3/field",{headers});
 const flagged=meta.find((f:any)=>f.name==="Flagged")?.id;
 const fields=["summary","status","assignee","updated","created","issuetype","priority","description","duedate","issuelinks",...(flagged?[flagged]:[])];
 async function search(jql:string){let token:string|undefined;const out:any[]=[];for(let n=0;n<100;n++){const d=await requestJSON(base+"/rest/api/3/search/jql",{method:"POST",headers,body:JSON.stringify({jql,fields,maxResults:100,...(token?{nextPageToken:token}:{})})});out.push(...d.issues);if(d.isLast===true||!d.nextPageToken)return out;token=d.nextPageToken;}throw new Error("Issue pagination limit reached; previous snapshot retained.");}
 const all:any[]=[];let sprintKeys:string[]=[];
 for(let n=0;n<projects.length;n+=30){const scope="project in ("+projects.slice(n,n+30).map(p=>'"'+p.key.replaceAll('"','\\"')+'"').join(",")+")";all.push(...await search(scope+" ORDER BY key ASC"));sprintKeys.push(...(await search(scope+" AND sprint in openSprints()")).map(i=>i.key));}
 const issues:Issue[]=all.map(i=>({key:i.key,project:i.key.split("-")[0],summary:i.fields.summary,status:i.fields.status.name,category:i.fields.status.statusCategory.name,assignee:i.fields.assignee?.displayName??null,created:i.fields.created,updated:i.fields.updated,type:i.fields.issuetype.name,priority:i.fields.priority?.name,description:plain(i.fields.description),due:i.fields.duedate??null,links:i.fields.issuelinks??[],flagged:!!(flagged&&i.fields[flagged]?.length)}));
 const warnings:string[]=[],sprints:any[]=[];
 try{const boards:any[]=[];for(const project of projects)for(const board of await pages('/rest/agile/1.0/board?projectKeyOrId='+encodeURIComponent(project.key)))if(!boards.some(b=>b.id===board.id))boards.push(board);for(const b of boards){try{const rows=await pages("/rest/agile/1.0/board/"+b.id+"/sprint?state=active");for(const s of rows)if(!sprints.some(p=>p.id===s.id))sprints.push({...s,board:b.name});}catch{warnings.push("Sprint metadata unavailable for "+b.name+"; board may not support sprints.");}}}catch{warnings.push("Board metadata unavailable; sprint commitments cannot be confirmed.");}
 const unassigned=issues.filter(i=>i.category!=="Done"&&!i.assignee).length;
 return {id:crypto.randomUUID(),fetchedAt:new Date().toISOString(),source:"Jira API · complete scoped retrieval",projects,issues,sprints,sprintNote:sprintKeys.length+" issues returned by scoped openSprints() queries.",warnings,assessment:unassigned?unassigned+" unfinished issues have no Jira assignee. Confirm ownership before committing to delivery dates.":"Review open dependencies and evidence before confirming delivery confidence."};
}
function plain(v:any):string {if(!v)return "";if(typeof v==="string")return v;return [v.text??"",...(v.content??[]).map(plain)].join(" ").trim();}
