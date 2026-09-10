import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {steercoModel} from '../lib/steerco.ts';
const runtime=process.env.RUNTIME_NODE_MODULES??'/Users/shru212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(runtime,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const skill='/Users/shru212/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const {resolvePresentationFont,applyPresentationChartFont,finalizePresentation}=await import(skill+'/container_tools/artifact_tool_utils.mjs');
const root=path.resolve(import.meta.dirname,'..'),data=JSON.parse(await fs.readFile(process.argv[2]??root+'/lib/baseline.json','utf8'));
const model=steercoModel(data),font=resolvePresentationFont(),p=Presentation.create({slideSize:{width:1280,height:720}});
const stamp=data.fetchedAt.replace(/[^0-9]/g,'').slice(0,14)+'-'+Date.now();
const build=root+'/reports/.build',output=root+'/reports/output/SteerCo-Infographic-'+stamp+'.pptx';
await fs.mkdir(build,{recursive:true});await fs.mkdir(path.dirname(output),{recursive:true});
function text(s,t,x,y,w,h,size=24,color='#172942',bold=false){const shape=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});shape.text=t;shape.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none'};return shape;}
function slide(title,n){const s=p.slides.add();s.background.fill='#FFFFFF';text(s,title,58,36,1130,75,44,'#172942',true);text(s,String(n).padStart(2,'0')+' / 05',1110,651,115,30,20,'#7A8BA3');text(s,'Jira snapshot '+data.fetchedAt+'  •  PM assessments and proposals labelled',58,660,1020,29,17,'#728199');s.speakerNotes.textFrame.setText('Source query: project in (AUT, KAN, SMB) ORDER BY key ASC\nRetrieved '+data.fetchedAt+'\n'+data.issues.map(i=>i.key+' | '+i.status+' | '+(i.assignee??'Unassigned')+' | updated '+i.updated+' | https://shru2128.atlassian.net/browse/'+i.key).join('\n')+'\nPlanning gaps mean inputs absent from this reporting dataset, not proof of absence across the organization. Risk labels are PM assessments. No approved budget, quantified probability or board meeting date was supplied.');return s;}
let s=slide('Portfolio delivery review',1);
text(s,model.highDefects+' high-priority defects',58,122,365,45,30,'#B83140',true);text(s,model.unassigned+' unassigned open records',447,122,405,45,30,'#965805',true);text(s,model.planning.length+' planning input gaps',893,122,330,45,30,'#465BB8',true);
model.projects.forEach((project,i)=>{const x=58+i*400;text(s,project.agent, x,204,360,48,34,'#172942',true);text(s,project.name,x,252,360,34,23,'#6C7B92');text(s,project.level,x,290,360,34,24,project.level==='Escalate'?'#B83140':'#965805',true);const chart=s.charts.add('doughnut',{position:{left:x,top:341,width:350,height:227},categories:['Done','Active','Other'],series:[{name:'Jira records',values:[project.done,project.active,project.remaining],points:[{idx:0,fill:'#14A080'},{idx:1,fill:'#526AF2'},{idx:2,fill:'#DCE3EE'}]}],doughnutOptions:{holeSize:70},hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:20}},dataLabels:{showValue:true,showPercent:false,position:'center',textStyle:{fontSize:21}}});applyPresentationChartFont(chart,{fontFamily:font});text(s,`${project.done} Done / ${project.total} records`,x,578,360,38,25,'#172942',true);});
text(s,'Counts include parents and children. Release completion has no validated denominator.',58,620,1140,33,21,'#728199');
s=slide('Delivery risks requiring intervention',2);
text(s,'PM assessment: risk, impact and proposed response',58,117,1130,38,25,'#687A94');
model.risks.slice(0,4).forEach((risk,i)=>{const y=180+i*112;text(s,String(risk.evidence.length),58,y,100,64,48,risk.level==='Escalate'?'#B83140':'#965805',true);text(s,risk.title,180,y,1010,39,28,'#172942',true);text(s,risk.action,180,y+41,1010,60,23,'#596C87');});
text(s,'Risk themes can overlap. Evidence and issue owners appear in the speaker notes.',58,619,1110,35,21,'#728199');
s=slide('Budget and board approval gaps',3);
model.planning.forEach((risk,i)=>{const x=58+i*400;text(s,'INPUT NEEDED',x,157,360,35,20,'#965805',true);text(s,risk.title,x,207,352,95,32,'#172942',true);text(s,risk.impact,x,325,345,130,24,'#596C87');text(s,'Decision ask',x,475,345,32,22,'#3D58B4',true);text(s,risk.action,x,517,345,104,23,'#172942');});
s=slide('Decisions pending',4);
text(s,'Recommendations for approval. Proposed roles do not assign Jira ownership.',58,117,1150,46,23,'#687A94');
model.decisions.slice(0,7).forEach((d,i)=>{const y=182+i*64;text(s,String(i+1).padStart(2,'0'),58,y,62,41,29,'#9AA8BE');text(s,d.action,140,y,1060,56,24,'#172942',true);});
s=slide('Trade-offs for discussion',5);
text(s,'Choice',58,125,290,32,22,'#728199',true);text(s,'Option A',367,125,400,32,22,'#3D58B4',true);text(s,'Option B',803,125,415,32,22,'#3D58B4',true);
model.trades.forEach((t,i)=>{const y=183+i*145;text(s,t.title,58,y,276,109,28,'#172942',true);[t.a,t.b].forEach((o,j)=>{const x=367+j*436;text(s,o.title,x,y,398,59,25,'#172942',true);text(s,'Gain: '+o.gain+'\nCost: '+o.cost,x,y+58,398,85,21,'#596C87');});});
text(s,'Cost and schedule effects require validation before approval.',58,623,1100,30,21,'#728199');
const candidate=build+'/steerco-candidate-'+stamp+'.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
const result=await finalizePresentation({workspaceDir:root+'/reports',candidatePath:candidate,finalPath:output,pythonExecutable:'/Users/shru212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],explicitTotalSlideCount:5,requiredNativeChartOwnerSlides:[1],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:build+'/steerco-receipt-'+stamp+'.json'});
for(let i=0;i<p.slides.items.length;i++){const png=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(build+'/steerco-slide-'+(i+1)+'.png',new Uint8Array(await png.arrayBuffer()));}
console.log(JSON.stringify({output,snapshotId:data.id,asOf:data.fetchedAt,result}));
