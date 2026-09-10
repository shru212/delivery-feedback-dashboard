'use client';
import {useState} from 'react';
import type {DeliveryReport} from '@/lib/delivery-manager';
import {Button} from '@/components/ui/button';
const link=(key:string)=>'https://shru2128.atlassian.net/browse/'+encodeURIComponent(key);
export function DeliveryBrief({report}:{report?:DeliveryReport}){
 const [message,setMessage]=useState('');
 if(!report)return <section className="panel"><h2>Delivery Manager</h2><p>Load or refresh a snapshot to reconcile delivery evidence.</p></section>;
 return <section className="panel"><div className="row"><h2>Delivery Manager briefing</h2><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(report.briefing);setMessage('Briefing copied.');}catch{setMessage('Copy unavailable. Select the briefing text below.');}}}>Copy briefing</Button></div><p>{report.headline}</p><p className="footnote">PM assessment · {report.asOf} · not a guarantee of delivery dates</p><div className="projects">{report.projects.map(p=><article className="project" key={p.key}><span className="tag">{p.agentName} · {p.key}</span><h3>{p.health}</h3><p>{p.done} Done / {p.total} records</p><p>Agent evidence: <strong>{p.agent.state}</strong></p><p>{p.agent.summary}</p><small>Source update: {p.agent.sourceUpdatedAt??'Unavailable'}<br/>Checked: {p.agent.checkedAt??'Not collected'}</small>{p.conflicts.length>0&&<p className="stale">{p.conflicts.length} agent / Jira conflicts require review.</p>}</article>)}</div><details><summary>Read the complete briefing</summary><pre className="description" style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{report.briefing}</pre></details><p role="status">{message}</p></section>;
}
export function ManagerDecisions({report}:{report?:DeliveryReport}){
 if(!report)return null;
 return <section className="panel"><h2>Decisions & cross-project dependencies</h2><p className="muted">Recommended actions are assessments. Keys, statuses, owners and update times are Jira facts. Agent claims never overwrite Jira.</p>{report.dependencies.filter(d=>d.crossProject).map(d=><p key={d.from+':'+d.to}><a href={link(d.from)}>{d.from}</a> → blocked by <a href={link(d.to)}>{d.to}</a> · {d.state}</p>)}{!report.dependencies.some(d=>d.crossProject)&&<p>No structured cross-project blocking links found in this snapshot. This does not prove there are no dependencies.</p>}{report.decisions.map((d,n)=><article className="risk-row" key={d.kind+d.evidence.key+n}><strong>{d.kind}</strong><p>{d.text}</p><a className="issue-key" href={link(d.evidence.key)}>{d.evidence.key}</a><small> · {d.evidence.status} · {d.evidence.assignee??'Unassigned'} · updated {d.evidence.updated}</small></article>)}{!report.decisions.length&&<p>No decisions triggered by the current rules.</p>}</section>;
}
