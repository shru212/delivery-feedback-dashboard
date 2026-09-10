export default function DeliveryArchitecture(){
 return <section className="panel"><h2>Delivery Manager connections</h2><p>Sunny / Outside · Maya / Autopsy · Nora / Share My Bread</p><div className="pdlc-flow">{[
 ['Project evidence','Dated task summaries and structured issue claims. Collection waits for authenticated scheduler access.'],
 ['Jira verification','Fresh, paginated AUT / KAN / SMB retrieval; Jira fields override conflicting agent claims.'],
 ['LangChain manager','Rules assess health, dependencies and decisions. Missing evidence stays visible.'],
 ['Memory + snapshots','Optional Mem0 / Pinecone context; D1 supplies exact prior-day and prior-week comparisons.'],
 ['Reports','The saved snapshot includes project assessments and the daily briefing.'],
 ['09:00 IST schedule','Paused: an authenticated unattended connection has not been verified.']
 ].map(([title,description])=><div key={title}><strong>{title}</strong><p>{description}</p></div>)}</div><p className="footnote">Credentials are encrypted server-side. These connections do not change the project agents’ schedules or write Jira commitments.</p></section>;
}
