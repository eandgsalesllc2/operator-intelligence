import {Case,NodeType} from "./types";
import {providers,ProviderContext,ProviderFinding} from "./providers";
import {aiResearchEnabled,claudeResearch} from "./ai-research";
import {Draft,layout,mergeDraft} from "./case-builder";
import {cleanDomain,isPublicHostname} from "./net";
import {getInvestigation,saveInvestigation,saveProviderFindings,updateResearchJob} from "./repository";

const FREE_MAIL=/@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|live|msn|me|gmx|yandex|mail)\./i;

export function slugify(v:string){return v.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"case"}

export function normalizeSeed(value:string,type:NodeType){
 const v=value.trim();
 if(type==="domain")return cleanDomain(v);
 if(type==="email")return v.toLowerCase();
 return v.replace(/\s+/g," ");
}

export function guessSeedType(value:string):NodeType{
 const v=value.trim();
 if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v))return "email";
 if(/^\+?[\d\s().-]{10,}$/.test(v))return "phone";
 if(isPublicHostname(cleanDomain(v))&&!/\s/.test(v))return "domain";
 if(/\b(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|GmbH|B\.V\.|PBC|LLP|UAB|Holdings?)\b/i.test(v))return "company";
 if(/^\d+\s+\w+/.test(v))return "address";
 return "brand";
}

export function newCase(seedValue:string,seedType:NodeType,name?:string):Case{
 const id=slugify(name||seedValue)+"-"+Date.now().toString(36);
 const domain=seedType==="domain"?seedValue:"";
 const label=name?.trim()||seedValue;
 const today=new Date().toISOString().slice(0,10);
 return {id,name:label,domain,status:"Research running",summary:`Investigation seeded from ${seedType}: ${seedValue}.`,nodes:[{id:id+":seed",label:seedValue,type:seedType,subtitle:"Investigation seed",x:380,y:230,confidence:"lead",details:["Research seed"]}],edges:[],evidence:[],timeline:[{date:today,title:"Investigation created",body:`Seeded from ${seedType}: ${seedValue}.`}],openQuestions:[]};
}

function domainFor(c:Case,seedValue:string,seedType:NodeType){
 if(seedType==="domain")return cleanDomain(seedValue);
 if(seedType==="email"&&!FREE_MAIL.test(seedValue))return seedValue.split("@")[1].toLowerCase();
 if(seedType==="brand"&&c.domain&&c.name.toLowerCase()===seedValue.toLowerCase())return cleanDomain(c.domain);
 return "";
}

function prelimSummary(d:Draft){
 const lines=d.nodes.filter(n=>n.key!=="seed").slice(0,30).map(n=>`- ${n.type}: ${n.label} (${n.confidence}) — ${n.subtitle}${n.details.length?"; "+n.details.slice(0,3).join("; "):""}`);
 const ev=d.evidence.slice(0,15).map(e=>`- ${e.title}: ${e.source} — ${e.note.slice(0,200)}`);
 return [...lines,...(ev.length?["Sources:",...ev]:[])].join("\n");
}

export async function runResearchJob(job:any){
 const seedType=job.seed_type as NodeType;
 let lastLog=0;
 const log=async(message:string,progress?:number)=>{const now=Date.now();if(progress===undefined&&now-lastLog<1500)return;lastLog=now;await updateResearchJob(job.id,{message,...(progress!==undefined?{progress}:{})}).catch(()=>{})};
 try{
  await updateResearchJob(job.id,{status:"running",started_at:new Date().toISOString(),provider:"multi",progress:5,message:"Starting research"});
  const c=await getInvestigation(job.investigation_id);
  if(!c)throw new Error("Investigation not found");
  const seedNode=c.nodes.find(n=>n.id===job.seed_entity_id)||c.nodes.find(n=>n.id===c.id+":seed")||c.nodes.find(n=>n.label.toLowerCase()===String(job.seed_value).toLowerCase())||c.nodes[0];
  if(!seedNode)throw new Error("Investigation has no seed entity");
  const domain=domainFor(c,job.seed_value,seedType);
  const ctx:ProviderContext={seedValue:job.seed_value,seedType,domain,investigationId:c.id,log:m=>log(m)};
  const active=providers.filter(p=>p.supports(ctx));
  const drafts:Draft[]=[];const notes:string[]=[];let findingsTotal=0;
  let done=0;
  await Promise.all(active.map(async p=>{
   try{
    const r=await p.run(ctx);
    drafts.push(r.draft);notes.push(`${p.label}: ${r.notes.join("; ")}`);
    if(r.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:p.name,findings:r.findings});findingsTotal+=r.findings.length}
   }catch(e){notes.push(`${p.label}: failed — ${e instanceof Error?e.message:"error"}`)}
   done++;await log(`${p.label} done (${done}/${active.length})`,10+Math.round(done/active.length*(aiResearchEnabled()?30:80)));
  }));
  let merged=c;
  for(const d of drafts)merged=mergeDraft(merged,d,seedNode.id);
  if(aiResearchEnabled()){
   await log("Starting web research",45);
   const pre={nodes:drafts.flatMap(d=>d.nodes),evidence:drafts.flatMap(d=>d.evidence)} as Draft;
   try{
    const r=await claudeResearch.run({...ctx,log:(m:string)=>log(m),prelim:prelimSummary(pre)} as any);
    notes.push(`${claudeResearch.label}: ${r.notes.join("; ")}`);
    if(r.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:claudeResearch.name,findings:r.findings as ProviderFinding[]});findingsTotal+=r.findings.length}
    merged=mergeDraft(merged,r.draft,seedNode.id);
   }catch(e){notes.push(`${claudeResearch.label}: failed — ${e instanceof Error?e.message:"error"}`)}
  }
  const added=merged.nodes.length-c.nodes.length, newEvidence=merged.evidence.length-c.evidence.length;
  const today=new Date().toISOString().slice(0,10);
  const empty=findingsTotal===0&&added===0&&newEvidence===0;
  merged={...merged,
   status:empty?"Research found nothing":"Active investigation",
   timeline:[...merged.timeline,{date:today,title:`Research run: ${job.seed_value}`,body:`${added} new entities, ${newEvidence} new evidence items. ${notes.join(" | ").slice(0,900)}`}],
   openQuestions:aiResearchEnabled()?merged.openQuestions:[...merged.openQuestions,...(seedType!=="domain"&&!domain?["Web research is off (no ANTHROPIC_API_KEY), so only existing investigations were searched for this seed. Add the key in Vercel to research people, companies and brands on the web."]:[])],
  };
  merged.nodes=layout(merged.nodes,seedNode.id);
  await saveInvestigation(merged);
  const message=empty?"No sources found. "+notes.join(" | "):`Research complete · ${added} new entities · ${newEvidence} new evidence · ${findingsTotal} sources`;
  return await updateResearchJob(job.id,{status:empty?"failed":"completed",provider:"multi",progress:100,message:message.slice(0,1000),error:empty?"Nothing was collected":"",completed_at:new Date().toISOString()});
 }catch(error){
  const message=error instanceof Error?error.message:"Research failed";
  await updateResearchJob(job.id,{status:"failed",message:"Research failed: "+message,error:message,progress:100,completed_at:new Date().toISOString()}).catch(()=>{});
  return null;
 }
}
