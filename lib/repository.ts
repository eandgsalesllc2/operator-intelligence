import {Case,Confidence} from "./types";
import {KIND_LABEL,identifierRows,tagsFor} from "./profile";
import {cases as seedCases} from "./data";
import type {ProviderFinding} from "./providers";

const hasDb=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
async function request(path:string,init?:RequestInit){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Database is not configured");const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});if(!r.ok)throw new Error(await r.text());return r.status===204?null:r.json()}
const toCase=(i:any,nodes:any[],edges:any[],evidence:any[],timeline:any[],questions:any[]):Case=>({id:i.id,name:i.name,domain:i.domain,status:i.status,summary:i.summary,category:i.category||"",metrics:i.metrics&&Object.keys(i.metrics).length?i.metrics:undefined,profile:i.profile&&Object.keys(i.profile).length?i.profile:undefined,marketing:i.marketing&&Object.keys(i.marketing).length?i.marketing:undefined,tags:i.tags||[],nodes:nodes.map((n:any)=>({id:n.id,label:n.label,type:n.type,subtitle:n.subtitle,x:Number(n.x),y:Number(n.y),confidence:n.confidence,details:n.details||[]})),edges:edges.map((e:any)=>({from:e.from_entity,to:e.to_entity,label:e.label,confidence:e.confidence})),evidence:evidence.map((e:any)=>({id:e.id,title:e.title,source:e.source,confidence:e.confidence,note:e.note})),timeline:timeline.map((t:any)=>({date:t.event_date,title:t.title,body:t.body})),openQuestions:questions.map((q:any)=>q.question)});
// PostgREST caps each response (1000 rows by default), so page through with Range headers.
async function fetchAll(path:string){const out:any[]=[];const size=1000;for(let from=0;;from+=size){const rows=await request(path,{headers:{Range:`${from}-${from+size-1}`,"Range-Unit":"items"}});out.push(...rows);if(rows.length<size)break}return out}
const groupBy=(rows:any[])=>{const m=new Map<string,any[]>();for(const r of rows){const k=r.investigation_id;if(!m.has(k))m.set(k,[]);m.get(k)!.push(r)}return m};
export async function listInvestigations():Promise<Case[]>{if(!hasDb())return seedCases;const [investigations,nodes,edges,evidence,timeline,questions]=await Promise.all([fetchAll("investigations?select=id,name,domain,status,summary,category,metrics,tags,updated_at&order=monthly_visits.desc.nullslast,updated_at.desc"),fetchAll("entities?select=*&order=id.asc"),fetchAll("relationships?select=*&order=id.asc"),fetchAll("evidence?select=*&order=id.asc"),fetchAll("timeline?select=*&order=id.asc"),fetchAll("open_questions?resolved=eq.false&select=*&order=id.asc")]);if(!investigations.length)return seedCases;const [n,e,ev,t,q]=[nodes,edges,evidence,timeline,questions].map(groupBy);return investigations.map((i:any)=>toCase(i,n.get(i.id)||[],e.get(i.id)||[],ev.get(i.id)||[],t.get(i.id)||[],q.get(i.id)||[]))}
export async function getInvestigation(id:string):Promise<Case|null>{if(!hasDb())return seedCases.find(c=>c.id===id)||null;const q=encodeURIComponent(id);const rows=await request(`investigations?id=eq.${q}&select=*`);if(!rows.length)return null;const [nodes,edges,evidence,timeline,questions]=await Promise.all([request(`entities?investigation_id=eq.${q}&select=*`),request(`relationships?investigation_id=eq.${q}&select=*&order=id.asc`),request(`evidence?investigation_id=eq.${q}&select=*`),request(`timeline?investigation_id=eq.${q}&select=*&order=id.asc`),request(`open_questions?investigation_id=eq.${q}&resolved=eq.false&select=*&order=id.asc`)]);return toCase(rows[0],nodes,edges,evidence,timeline,questions)}
export type PortfolioMatch={investigation:{id:string;name:string;domain:string};entity:{id:string;label:string;type:string;confidence:Confidence};relations:{label:string;confidence:Confidence;other:string}[]};
// Find entities in other investigations whose label contains the term (people, companies, domains, emails, phones...).
export async function searchPortfolio(term:string,excludeInvestigationId?:string):Promise<PortfolioMatch[]>{
 if(!hasDb())return [];const t=term.trim().replace(/[*,()"]/g," ").replace(/\s+/g," ").trim();if(t.length<4)return [];
 // Every word must appear, in any order, so "Johnathan Sack" also finds "Johnathan P. Sack".
 const words=t.includes("@")||t.includes(".")&&!t.includes(" ")?[t]:t.split(" ").filter(w=>w.length>=2).slice(0,5);
 const filter=words.map(w=>`label=ilike.${encodeURIComponent("*"+w+"*")}`).join("&");
 const ents:any[]=await request(`entities?${filter}&select=id,label,type,confidence,investigation_id&limit=60`);
 const hits=ents.filter(e=>e.investigation_id!==excludeInvestigationId);if(!hits.length)return [];
 const invIds=[...new Set(hits.map(e=>e.investigation_id))];const entIds=hits.map(e=>e.id);
 const list=(xs:string[])=>xs.map(x=>'"'+x.replace(/"/g,'')+'"').join(",");
 const [invs,rels]=await Promise.all([request(`investigations?id=in.(${encodeURIComponent(list(invIds))})&select=id,name,domain`),request(`relationships?or=(${encodeURIComponent(`from_entity.in.(${list(entIds)}),to_entity.in.(${list(entIds)})`)})&select=from_entity,to_entity,label,confidence&limit=300`)]);
 const allIds=[...new Set(rels.flatMap((r:any)=>[r.from_entity,r.to_entity]))] as string[];
 const labels:any[]=allIds.length?await request(`entities?id=in.(${encodeURIComponent(list(allIds))})&select=id,label`):[];
 const lab=new Map(labels.map(l=>[l.id,l.label]));const inv=new Map<string,{id:string;name:string;domain:string}>(invs.map((i:any)=>[i.id,i]));
 return hits.filter(h=>inv.has(h.investigation_id)).map(h=>({investigation:inv.get(h.investigation_id)!,entity:{id:h.id,label:h.label,type:h.type,confidence:h.confidence},relations:rels.filter((r:any)=>r.from_entity===h.id||r.to_entity===h.id).map((r:any)=>({label:r.label,confidence:r.confidence,other:lab.get(r.from_entity===h.id?r.to_entity:r.from_entity)||""}))}));
}
export async function createInvestigationRecord(c:Case){return saveInvestigation(c)}
export async function saveInvestigation(c:Case){if(!hasDb())throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");await request("investigations?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({id:c.id,name:c.name,domain:c.domain,status:c.status,summary:c.summary,category:c.category||"",...(c.metrics?{metrics:c.metrics,monthly_visits:c.metrics.monthlyVisits??null}:{}),...(c.profile?{profile:c.profile}:{}),...(c.marketing?{marketing:c.marketing}:{}),...(c.profile||c.marketing?{tags:[...tagsFor(c.profile,c.marketing,/^\[(.+?)\]/.exec(c.summary||"")?.[1]),...(c.metrics?.subscription?.focused?["subscription"]:[])]}:{}),updated_at:new Date().toISOString()})});for(const table of ["relationships","entities","evidence","timeline","open_questions"])await request(table+"?investigation_id=eq."+encodeURIComponent(c.id),{method:"DELETE"});if(c.nodes.length)await request("entities",{method:"POST",body:JSON.stringify(c.nodes.map(n=>({...n,investigation_id:c.id})))});if(c.edges.length)await request("relationships",{method:"POST",body:JSON.stringify(c.edges.map(e=>({investigation_id:c.id,from_entity:e.from,to_entity:e.to,label:e.label,confidence:e.confidence})))});if(c.evidence.length)await request("evidence",{method:"POST",body:JSON.stringify(c.evidence.map(e=>({...e,investigation_id:c.id})))});if(c.timeline.length)await request("timeline",{method:"POST",body:JSON.stringify(c.timeline.map(t=>({investigation_id:c.id,event_date:t.date,title:t.title,body:t.body})))});if(c.openQuestions.length)await request("open_questions",{method:"POST",body:JSON.stringify(c.openQuestions.map(question=>({investigation_id:c.id,question})))});if(c.profile||c.marketing){await request("oi_identifiers?investigation_id=eq."+encodeURIComponent(c.id),{method:"DELETE"});const rows=identifierRows(c.profile,c.marketing,c.domain);if(rows.length)await request("oi_identifiers",{method:"POST",body:JSON.stringify(rows.map(r=>({...r,investigation_id:c.id})))})}return c}
export function databaseConfigured(){return hasDb()}

export async function listResearchJobs(investigationId:string){if(!hasDb())return [];return request("oi_research_jobs?investigation_id=eq."+encodeURIComponent(investigationId)+"&select=*&order=created_at.desc")}
export async function listResearchSources(investigationId:string){if(!hasDb())return [];return request("oi_sources?investigation_id=eq."+encodeURIComponent(investigationId)+"&select=*&order=retrieved_at.desc")}
export async function queueResearchJob(input:{investigationId:string;seedEntityId?:string|null;seedValue:string;seedType:string;maxDepth?:number;userId?:string|null}){const id="job_"+Date.now().toString(36);const rows=await request("oi_research_jobs",{method:"POST",body:JSON.stringify({id,investigation_id:input.investigationId,...(input.userId?{user_id:input.userId}:{}),seed_entity_id:input.seedEntityId||null,seed_value:input.seedValue,seed_type:input.seedType,status:"queued",depth:0,max_depth:Math.max(1,Math.min(input.maxDepth||3,5)),provider:"pending",progress:0,message:"Queued for research",error:""})});return rows[0]}
export async function getResearchJob(id:string){if(!hasDb())return null;const rows=await request("oi_research_jobs?id=eq."+encodeURIComponent(id)+"&select=*");return rows[0]||null}
export async function updateResearchJob(id:string,patch:Record<string,unknown>){const rows=await request("oi_research_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});return rows[0]}
export async function saveProviderFindings(input:{investigationId:string;jobId:string;provider:string;findings:ProviderFinding[]}){
 if(!input.findings.length)return [];
 const stamp=Date.now().toString(36);
 const rows=input.findings.map((f,i)=>({id:"finding_"+stamp+"_"+i,investigation_id:input.investigationId,research_job_id:input.jobId,provider:input.provider,title:f.title,url:f.url,publisher:f.publisher,snippet:f.snippet,source_type:f.sourceType,entities:f.entities,claims:f.claims,status:"pending"}));
 await request("oi_provider_findings",{method:"POST",body:JSON.stringify(rows)});
 const sources=input.findings.map((f,i)=>({id:"source_"+stamp+"_"+i,investigation_id:input.investigationId,research_job_id:input.jobId,url:f.url,title:f.title,source_type:f.sourceType,publisher:f.publisher,snippet:f.snippet,metadata:{provider:input.provider}}));
 await request("oi_sources?on_conflict=investigation_id,url",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(sources)});
 return rows;
}

export async function deleteInvestigation(id:string){
 if(!hasDb())throw new Error("Database is not configured");
 const q=encodeURIComponent(id);
 for(const table of ["oi_evidence_links","oi_provider_findings","oi_sources"])await request(table+"?investigation_id=eq."+q,{method:"DELETE"});
 await request("oi_research_jobs?investigation_id=eq."+q,{method:"DELETE"});
 await request("investigations?id=eq."+q,{method:"DELETE"});
 return {id};
}

export type IdentifierMatch={investigation_id:string;name:string;domain:string;category:string;kind:string;value:string;normalized:string};
// Which other investigations carry the same identifiers (tracking IDs, accounts, contacts, companies, people, attorneys)?
export async function matchIdentifiers(normalized:string[],excludeInvestigationId?:string):Promise<IdentifierMatch[]>{
 if(!hasDb()||!normalized.length)return [];
 const list=[...new Set(normalized)].slice(0,200).map(x=>'"'+x.replace(/"/g,"")+'"').join(",");
 const rows:any[]=await request(`oi_identifiers?normalized=in.(${encodeURIComponent(list)})&select=investigation_id,kind,value,normalized&limit=1000`);
 const hits=rows.filter(r=>r.investigation_id!==excludeInvestigationId);if(!hits.length)return [];
 const ids=[...new Set(hits.map(r=>r.investigation_id))].map(x=>'"'+x+'"').join(",");
 const invs:any[]=await request(`investigations?id=in.(${encodeURIComponent(ids)})&select=id,name,domain,category`);
 const inv=new Map(invs.map(i=>[i.id,i]));
 return hits.filter(h=>inv.has(h.investigation_id)).map(h=>({...h,name:inv.get(h.investigation_id).name,domain:inv.get(h.investigation_id).domain,category:inv.get(h.investigation_id).category||""}));
}

// ---------- Networks: clusters of investigations that share strong identifiers or a named parent network ----------
export type NetworkLink={a:string;b:string;shared:{kind:string;value:string}[]};
export type NetworkCluster={id:string;label:string;members:{id:string;name:string;domain:string;category:string;visits:number|null}[];links:NetworkLink[];hard:boolean;visits:number};
const HARD=new Set(["company","person","trademark_serial","phone","email","shopify_store","shopify_shop_id","gtm","google_analytics","google_ads","meta_pixel","tiktok_pixel","clarity","klaviyo","checkout_account","payment_id","amazon_seller","card_descriptor"]);
const LINKING=new Set([...HARD,"domain","address","funnel_host","tracking"]);
export async function networkClusters():Promise<NetworkCluster[]>{
 if(!hasDb())return [];
 const [ids,invs]=await Promise.all([fetchAll("oi_identifiers?select=investigation_id,kind,value,normalized"),fetchAll("investigations?select=id,name,domain,category,tags,monthly_visits")]);
 const inv=new Map<string,any>(invs.map((i:any)=>[i.id,i]));
 // identifier → investigations that carry it
 const groups=new Map<string,{kind:string;value:string;ids:Set<string>}>();
 for(const r of ids){if(!LINKING.has(r.kind)||!inv.has(r.investigation_id))continue;const k=r.kind+"|"+r.normalized;const g=groups.get(k)||{kind:r.kind,value:r.value,ids:new Set<string>()};g.ids.add(r.investigation_id);groups.set(k,g)}
 // Named parent networks from tags ("network:Guthy-Renker") link their members too.
 for(const i of invs)for(const t of (i.tags||[]) as string[])if(t.startsWith("network:")){const k="network|"+t.slice(8).toLowerCase().replace(/[.,]|\b(inc|llc|ltd|corp|co)\b/g,"").trim();const g=groups.get(k)||{kind:"network",value:t.slice(8),ids:new Set<string>()};g.ids.add(i.id);groups.set(k,g)}
 const pair=new Map<string,NetworkLink>();
 for(const g of groups.values()){
  if(g.ids.size<2||g.ids.size>12)continue; // very common values are vendors, not operators
  const list=[...g.ids].sort();
  for(let x=0;x<list.length;x++)for(let y=x+1;y<list.length;y++){const k=list[x]+"~"+list[y];const l=pair.get(k)||{a:list[x],b:list[y],shared:[]};l.shared.push({kind:g.kind,value:g.value});pair.set(k,l)}
 }
 // union-find over linked pairs
 const parent=new Map<string,string>();const find=(x:string):string=>{const p=parent.get(x)??x;if(p===x)return x;const r=find(p);parent.set(x,r);return r};
 for(const l of pair.values()){const ra=find(l.a),rb=find(l.b);if(ra!==rb)parent.set(ra,rb)}
 const comps=new Map<string,Set<string>>();for(const l of pair.values())for(const id of [l.a,l.b]){const r=find(id);if(!comps.has(r))comps.set(r,new Set());comps.get(r)!.add(id)}
 const out:NetworkCluster[]=[];
 for(const [root,memberIds] of comps){
  const links=[...pair.values()].filter(l=>memberIds.has(l.a));
  const members=[...memberIds].map(id=>{const i=inv.get(id);return {id,name:i.name,domain:i.domain||"",category:i.category||"",visits:i.monthly_visits??null}}).sort((a,b)=>(b.visits||0)-(a.visits||0));
  const counts=new Map<string,number>();for(const l of links)for(const s of l.shared)if(["network","company","person"].includes(s.kind))counts.set(s.value,(counts.get(s.value)||0)+1);
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  out.push({id:root,label:top||members.slice(0,2).map(m=>m.name).join(" + "),members,links,hard:links.some(l=>l.shared.some(s=>HARD.has(s.kind)||s.kind==="network")),visits:members.reduce((s,m)=>s+(m.visits||0),0)});
 }
 return out.sort((a,b)=>Number(b.hard)-Number(a.hard)||b.members.length-a.members.length||b.visits-a.visits);
}

// Recompute filter tags for every investigation (after the tag rules change). Only the tags column is written.
export async function retagAll(){
 const rows=await fetchAll("investigations?select=id,summary,profile,marketing,metrics,tags");
 let changed=0;
 for(const r of rows){
  if(!r.profile&&!r.marketing)continue;
  const tags=[...tagsFor(r.profile,r.marketing,/^\[(.+?)\]/.exec(r.summary||"")?.[1]),...(r.metrics?.subscription?.focused?["subscription"]:[])];
  if(JSON.stringify([...tags].sort())===JSON.stringify([...(r.tags||[])].sort()))continue;
  await request("investigations?id=eq."+encodeURIComponent(r.id),{method:"PATCH",body:JSON.stringify({tags})});changed++;
 }
 return {checked:rows.length,changed};
}

// ---------- Search across brands, graph entities and the identifier index ----------
export type SearchHit={group:"brand"|"identifier"|"entity";label:string;detail:string;caseId:string;caseName:string};
export async function searchAll(q:string):Promise<SearchHit[]>{
 if(!hasDb())return [];
 const term=q.trim().toLowerCase().replace(/[*,()"\\]/g," ").replace(/\s+/g," ").slice(0,80);if(term.length<2)return [];
 const like=encodeURIComponent(`*${term}*`);
 const [brands,ids,ents]=await Promise.all([
  request(`investigations?select=id,name,domain,category&or=(name.ilike.${like},domain.ilike.${like})&limit=12`),
  request(`oi_identifiers?select=investigation_id,kind,value&or=(normalized.ilike.${like},value.ilike.${like})&limit=60`),
  request(`entities?select=investigation_id,label,type,subtitle&label=ilike.${like}&type=in.(person,company,trademark,email,phone,address,domain)&limit=60`),
 ]);
 const need=new Set<string>([...ids.map((r:any)=>r.investigation_id),...ents.map((r:any)=>r.investigation_id)]);
 const names=new Map<string,string>();
 if(need.size){const rows=await request(`investigations?select=id,name&id=in.(${[...need].map(x=>`"${x.replace(/"/g,"")}"`).join(",")})`);for(const r of rows)names.set(r.id,r.name)}
 const out:SearchHit[]=[];const seen=new Set<string>();
 const push=(h:SearchHit)=>{const k=h.group+"|"+h.label.toLowerCase()+"|"+h.caseId;if(seen.has(k))return;seen.add(k);out.push(h)};
 for(const b of brands)push({group:"brand",label:b.name,detail:[b.domain,b.category].filter(Boolean).join(" · "),caseId:b.id,caseName:b.name});
 for(const r of ids)if(names.has(r.investigation_id))push({group:"identifier",label:r.value,detail:(KIND_LABEL[r.kind]||r.kind),caseId:r.investigation_id,caseName:names.get(r.investigation_id)!});
 for(const e of ents)if(names.has(e.investigation_id))push({group:"entity",label:e.label,detail:`${e.type}${e.subtitle?" · "+e.subtitle:""}`,caseId:e.investigation_id,caseName:names.get(e.investigation_id)!});
 return out.slice(0,60);
}

// Update only a case's metrics/marketing (and the tags + identifier index that depend on them) — used by watchlist checks.
export async function refreshMarketing(c:Case){
 const tags=[...tagsFor(c.profile,c.marketing,/^\[(.+?)\]/.exec(c.summary||"")?.[1]),...(c.metrics?.subscription?.focused?["subscription"]:[])];
 await request("investigations?id=eq."+encodeURIComponent(c.id),{method:"PATCH",body:JSON.stringify({metrics:c.metrics||{},marketing:c.marketing||{},monthly_visits:c.metrics?.monthlyVisits??null,tags,updated_at:new Date().toISOString()})});
 await request("oi_identifiers?investigation_id=eq."+encodeURIComponent(c.id),{method:"DELETE"});
 const rows=identifierRows(c.profile,c.marketing,c.domain);
 if(rows.length)await request("oi_identifiers",{method:"POST",body:JSON.stringify(rows.map(r=>({...r,investigation_id:c.id})))});
}
