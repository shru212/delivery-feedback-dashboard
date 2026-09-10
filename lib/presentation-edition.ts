export type PresentationEdition={base64:string;snapshotId?:string};
export function selectEdition(row:{payload:string;snapshot_id:string}|null,initial:PresentationEdition,requested:string|null):PresentationEdition|null{
 if(row&&(!requested||row.snapshot_id===requested))return {base64:row.payload,snapshotId:row.snapshot_id};
 return !requested||initial.snapshotId===requested?initial:null;
}
export function presentationResponse(edition:PresentationEdition){
 return new Response(Uint8Array.from(atob(edition.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':'attachment; filename="SteerCo-Infographic.pptx"','X-Snapshot-Id':edition.snapshotId??'legacy','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
