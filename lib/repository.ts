import {Case,Confidence} from "./types";
import {cases as seedCases} from "./data";
import type {ProviderFinding} from "./providers";

const hasDb=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
async function request(path:string,init?:RequestInit){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Database is not configured");const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});if(!r.ok)throw new Error(await r.text());return r.status===204?null:r.json()}
const toCase=(i:any,nodes:any[],edges:any[],evidence:any[],timeline:any[],questions:any[]):Case=>({id:i.id,name:i.name,domain:i.domain,status:i.status,summary:i.summary,category:i.category||"",nodes:nodes.map((n:any)=>({id:n.id,label:n.label,type:n.type,subtitle:n.subtitle,x:Number(n.x),y:Number(n.y),confidence:n.confidence,details:n.details||[]})),edges:edges.map((e:any)=>({from:e.from_entity,to:e.to_entity,label:e.label,confidence:e.confidence})),evidence:evidence.map((e:any)=>({id:e.id,title:e.title,source:e.source,confidence:e.confidence,note:e.note})),timeline:timeline.map((t:any)=>({date:t.event_date,title:t.title,body:t.body})),openQuestions:questions.map((q:any)=>q.question)});
// PostgREST caps each response (1000 rows by default), so page through with Range headers.
async function fetchAll(path:string){const out:any[]=[];const size=1000;for(let from=0;;from+=size){const rows=await request(path,{headers:{Range:`${from}-${from+size-1}`,"Range-Unit":"items"}});out.push(...rows);if(rows.length<size)break}return out}
const groupBy=(rows:any[])=>{const m=new Map<string,any[]>();for(const r of rows){const k=r.investigation_id;if(!m.has(k))m.set(k,[]);m.get(k)!.push(r)}return m};
export async function listInvestigations():Promise<Case[]>{if(!hasDb())return seedCases;const [investigations,nodes,edges,evidence,timeline,questions]=await Promise.all([fetchAll("investigations?select=*&order=updated_at.desc"),fetchAll("entities?select=*&order=id.asc"),fetchAll("relationships?select=*&order=id.asc"),fetchAll("evidence?select=*&order=id.asc"),fetchAll("timeline?select=*&order=id.asc"),fetchAll("open_questions?resolved=eq.false&select=*&order=id.asc")]);if(!investigations.length)return seedCases;const [n,e,ev,t,q]=[nodes,edges,evidence,timeline,questions].map(groupBy);return investigations.map((i:any)=>toCase(i,n.get(i.id)||[],e.get(i.id)||[],ev.get(i.id)||[],t.get(i.id)||[],q.get(i.id)||[]))}
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
export async function saveInvestigation(c:Case){if(!hasDb())throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");await request("investigations?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({id:c.id,name:c.name,domain:c.domain,status:c.status,summary:c.summary,category:c.category||"",updated_at:new Date().toISOString()})});for(const table of ["relationships","entities","evidence","timeline","open_questions"])await request(table+"?investigation_id=eq."+encodeURIComponent(c.id),{method:"DELETE"});if(c.nodes.length)await request("entities",{method:"POST",body:JSON.stringify(c.nodes.map(n=>({...n,investigation_id:c.id})))});if(c.edges.length)await request("relationships",{method:"POST",body:JSON.stringify(c.edges.map(e=>({investigation_id:c.id,from_entity:e.from,to_entity:e.to,label:e.label,confidence:e.confidence})))});if(c.evidence.length)await request("evidence",{method:"POST",body:JSON.stringify(c.evidence.map(e=>({...e,investigation_id:c.id})))});if(c.timeline.length)await request("timeline",{method:"POST",body:JSON.stringify(c.timeline.map(t=>({investigation_id:c.id,event_date:t.date,title:t.title,body:t.body})))});if(c.openQuestions.length)await request("open_questions",{method:"POST",body:JSON.stringify(c.openQuestions.map(question=>({investigation_id:c.id,question})))});return c}
export function databaseConfigured(){return hasDb()}

export async function listResearchJobs(investigationId:string){if(!hasDb())return [];return request("oi_research_jobs?investigation_id=eq."+encodeURIComponent(investigationId)+"&select=*&order=created_at.desc")}
export async function listResearchSources(investigationId:string){if(!hasDb())return [];return request("oi_sources?investigation_id=eq."+encodeURIComponent(investigationId)+"&select=*&order=retrieved_at.desc")}
export async function queueResearchJob(input:{investigationId:string;seedEntityId?:string|null;seedValue:string;seedType:string;maxDepth?:number}){const id="job_"+Date.now().toString(36);const rows=await request("oi_research_jobs",{method:"POST",body:JSON.stringify({id,investigation_id:input.investigationId,seed_entity_id:input.seedEntityId||null,seed_value:input.seedValue,seed_type:input.seedType,status:"queued",depth:0,max_depth:Math.max(1,Math.min(input.maxDepth||3,5)),provider:"pending",progress:0,message:"Queued for research",error:""})});return rows[0]}
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
