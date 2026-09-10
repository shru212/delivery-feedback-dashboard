import type {Snapshot} from './health';
import {comparisonWindow} from './delivery-manager';
import baseline from './baseline.json';
import archive from './archive.json';

// Read complete payloads only for the latest records and exact comparison windows.
// Frequent refreshes must not evict yesterday's/week-ago baseline from consideration.
export async function snapshotHistory(db:D1Database,owner:string,asOf=new Date().toISOString()):Promise<Snapshot[]>{
 const recent=await db.prepare('SELECT payload FROM snapshots WHERE user_id=? ORDER BY fetched_at DESC LIMIT 30').bind(owner).all<{payload:string}>();
 const history:Snapshot[]=[baseline,...archive,...recent.results.map(r=>JSON.parse(r.payload))];
 const latest=history.filter(s=>s.fetchedAt<=asOf).sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt))[0];
 const anchors=[asOf,...(latest?[latest.fetchedAt]:[])];
 for(const anchor of anchors)for(const days of [1,7]){
  const w=comparisonWindow(anchor,days);
  const row=await db.prepare('SELECT payload FROM snapshots WHERE user_id=? AND fetched_at>=? AND fetched_at<? ORDER BY fetched_at DESC LIMIT 1').bind(owner,w.start,w.end).first<{payload:string}>();
  if(row)history.push(JSON.parse(row.payload));
 }
 return [...new Map(history.map(s=>[s.id,s])).values()].sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt));
}
