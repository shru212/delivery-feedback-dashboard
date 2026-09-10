import {z} from 'zod';
export const agentTasks={KAN:'01a08c8b-8f77-7233-8178-694540aed56a',AUT:'01a0819e-8de1-7200-ba27-a0f4ca848c57',SMB:'01a081b1-bae6-7da3-9fdf-98c565cd7dbb'} as const;
export const preferenceSchema=z.object({enabled:z.boolean(),cadence:z.enum(['daily','weekdays','weekly']),time:z.string().regex(/^([01]\d|2[0-3]):00$/),weekday:z.number().int().min(0).max(6),timezone:z.literal('Asia/Kolkata'),agents:z.object({KAN:z.string().trim().min(1).max(60),AUT:z.string().trim().min(1).max(60),SMB:z.string().trim().min(1).max(60)}).strict()}).strict();
export type Preferences=z.infer<typeof preferenceSchema>;
export const defaultPreferences:Preferences={enabled:true,cadence:'daily',time:'09:00',weekday:1,timezone:'Asia/Kolkata',agents:{KAN:'Sunny',AUT:'Maya',SMB:'Nora'}};
// Reporting windows are evaluated in IST, independent of the host timezone.
export function latestSlot(p:Preferences,now=new Date()):string|null {
 if(!p.enabled)return null;
 const local=new Date(now.getTime()+330*60000);
 for(let n=0;n<8;n++){
  const d=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-n,Number(p.time.slice(0,2))));
  const day=d.getUTCDay(),slot=new Date(d.getTime()-330*60000);
  if(slot>now)continue;
  if(p.cadence==='weekdays'&&(day===0||day===6))continue;
  if(p.cadence==='weekly'&&day!==p.weekday)continue;
  return slot.toISOString();
 }
 return null;
}
export function nextSlot(p:Preferences,now=new Date()):string|null{
 if(!p.enabled)return null;
 for(let n=1;n<=8*24;n++){const d=new Date(now.getTime()+n*3600000);const slot=latestSlot(p,d);if(slot&&new Date(slot)>now)return slot;}
 return null;
}
