import { z } from "zod";
export const settingsSchema = z.object({
 jiraSite:z.literal("https://shru2128.atlassian.net").default("https://shru2128.atlassian.net"),
 jiraEmail:z.string().email().max(254).or(z.literal("")).default(""),
 jiraToken:z.string().max(4096).optional(),
 mem0Key:z.string().max(4096).optional(),
 pineconeKey:z.string().max(4096).optional(),
 pineconeHost:z.string().max(250).default(""),
 memoryConsent:z.boolean().default(false),
}).strict().superRefine((v,c)=>{if(v.pineconeHost&&!/^[a-z0-9][a-z0-9.-]*\.svc\.[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pinecone\.io$/.test(v.pineconeHost))c.addIssue({code:"custom",path:["pineconeHost"],message:"Use a Pinecone index hostname ending in .pinecone.io (no https:// or path)."});});
export type Settings=z.infer<typeof settingsSchema>;
export const defaults:Settings={jiraSite:"https://shru2128.atlassian.net",jiraEmail:"",pineconeHost:"",memoryConsent:false};
export function assertOrigin(req:Request,allowed:string){
 const origin=req.headers.get("origin");
 if(!allowed||origin!==allowed)throw new Error("origin");
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")throw new Error("content");
}
export async function limitedJSON(req:Request,limit=16384){
 const reader=req.body?.getReader();if(!reader)throw new Error("body");
 let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error("size");}chunks.push(value);}
 const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
function from64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function to64(a:Uint8Array){return btoa(String.fromCharCode(...a));}
async function key(secret:string){const bytes=from64(secret);if(bytes.length!==32)throw new Error("vault");return crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt","decrypt"]);}
export async function encrypt(value:unknown,owner:string,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(owner)},await key(secret),new TextEncoder().encode(JSON.stringify(value)));
 return JSON.stringify({v:1,iv:to64(iv),data:to64(new Uint8Array(bytes))});
}
export async function decrypt(value:string,owner:string,secret:string){
 const box=JSON.parse(value);if(box.v!==1)throw new Error("vault");
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:from64(box.iv),additionalData:new TextEncoder().encode(owner)},await key(secret),from64(box.data))));
}
export function safeSettings(s:Settings){return {jiraSite:s.jiraSite,jiraEmail:s.jiraEmail,pineconeHost:s.pineconeHost,memoryConsent:s.memoryConsent,jiraConfigured:!!s.jiraToken,mem0Configured:!!s.mem0Key,pineconeConfigured:!!s.pineconeKey,langchain:"Enabled — no API key needed"};}
