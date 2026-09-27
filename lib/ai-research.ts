import Anthropic from "@anthropic-ai/sdk";
import {z} from "zod";
import {zodOutputFormat} from "@anthropic-ai/sdk/helpers/zod";
import {NodeType} from "./types";
import {CATEGORIES} from "./categories";
import {Draft,addEdge,addEvidence,addNode,emptyDraft} from "./case-builder";
import {ProviderContext,ProviderFinding,ProviderResult,ResearchProvider} from "./providers";

const MODEL="claude-opus-5";
const RESEARCH_DEADLINE_MS=160_000; // leaves time to structure results and scan a separate store domain within the 300s function limit

const SYSTEM=`You are an OSINT business-ownership analyst mapping who legally owns, who operates, and who is connected to direct-to-consumer ecommerce brands (mostly supplements and wellness). You are given one seed — a brand, domain, person, company, trademark, address, phone or email — plus preliminary findings already collected. Investigate outward with web search and web fetch.

Method:
1. First-party: the brand's terms, privacy, refund, contact and about pages (legal entity, d/b/a, addresses, phones, support emails, copyright lines).
2. Trademarks: USPTO (tsdr.uspto.gov, uspto.report), Justia Trademarks, Trademarkia, EUIPO — owner, serial number, attorney of record, other marks by the same owner.
3. Corporate registries and mirrors: OpenCorporates, state Secretary of State sites, Bizapedia, Companies House, flcompany.info — officers, registered agent, formation date.
4. Public web: press, founder interviews, LinkedIn/job posts, BBB, Trustpilot, Reddit, court dockets (CourtListener, Justia), FDA letters, card-statement descriptors.
5. Pivot once on each new company, person, email, phone or tracking ID to find sibling brands and domains.
For a person or company seed, find every brand and company they are tied to and in what role.

Rules:
- Do not overclaim. Distinguish legal owner, IP owner, officer/manager, operator, agency or service provider, registered agent, fulfillment, and shared vendor. Registered-agent and virtual-office addresses, checkout/subscription vendors, trademark attorneys and shared templates never establish ownership on their own.
- Label every conclusion CONFIRMED (direct documentary evidence), STRONG (several independent signals agree), CORRELATION (real overlap that does not show ownership), LEAD (worth checking) or EXCLUDED (checked and ruled out).
- Every claim needs a source URL and what exactly that source says. Never invent URLs, names, dates or registration numbers. If a source was blocked, say so.
- Business roles only. Do not record residential addresses, personal emails or phones, relatives, or family details — not even to rule them out.
- Do not bypass CAPTCHAs, log in anywhere, or submit forms.

Write your final answer as a dossier: a one-sentence cautious summary; then sections for Entities (name, type, role, confidence), Relationships (from → label → to, confidence, source URL), Connected brands/domains, Timeline (dated events with sources), Evidence log (URL — what it says), and Open questions.`;

const NODE_TYPES=["brand","person","company","trademark","domain","address","phone","email"] as const;
const CONF=["confirmed","strong","correlation","lead","excluded"] as const;
const CaseSchema=z.object({
 category:z.enum(CATEGORIES).describe("What the seed brand (or the brands tied to a person/company seed) mainly sells"),
 summary:z.string().describe("One or two cautious sentences separating legal owner from operator"),
 nodes:z.array(z.object({key:z.string().describe('"seed" for the seed entity; otherwise a short unique slug'),label:z.string(),type:z.enum(NODE_TYPES),subtitle:z.string().describe("Role, e.g. 'Legal seller named in terms'"),confidence:z.enum(CONF),details:z.array(z.string())})),
 edges:z.array(z.object({from:z.string(),to:z.string(),label:z.string().describe("e.g. LEGAL OWNER, IP OWNER, TRADEMARK OWNER, MANAGES, DIRECTOR OF, OPERATES, EMPLOYED BY, CO-OWNER, FILED, MERCHANT FOR, SHARED ADDRESS, SHARED PHONE, SHARED EMAIL, SHARED INFRASTRUCTURE, PREDECESSOR, REBRANDED TO, PIVOT / INVESTIGATE"),confidence:z.enum(CONF)})),
 evidence:z.array(z.object({title:z.string(),url:z.string(),confidence:z.enum(CONF),note:z.string().describe("Exactly what the source supports")})),
 timeline:z.array(z.object({date:z.string().describe("YYYY-MM-DD, YYYY-MM or YYYY"),title:z.string(),body:z.string()})),
 open_questions:z.array(z.string()),
 store_domain:z.string().nullable().describe("The brand's actual storefront domain (e.g. rhodeskin.com) when it differs from the seed domain; null if the seed is the store or unknown"),
 profile:z.object({
  ownership_status:z.enum(["identified","legal_entity_only","operator_unknown","contested"]).describe("identified = beneficial owner/parent documented; legal_entity_only = only a legal seller/IP owner is known; operator_unknown = no entity found; contested = sources conflict"),
  ownership_note:z.string().describe("One or two sentences: who owns, who operates, and what is not yet proven"),
  network:z.string().nullable().describe("Parent company or operator group, if documented"),
  entities:z.array(z.object({name:z.string(),role:z.enum(["legal seller","ip owner","parent","operator","manager","predecessor","other"]),jurisdiction:z.string().nullable(),file_number:z.string().nullable(),formed:z.string().nullable(),status:z.string().nullable(),registered_agent:z.string().nullable(),confidence:z.enum(CONF),source:z.string().nullable()})).describe("Companies in business roles; use 'other' for service providers and registered agents"),
  trademarks:z.array(z.object({mark:z.string(),serial:z.string().nullable(),registration:z.string().nullable(),owner:z.string().nullable(),status:z.string().nullable(),filed:z.string().nullable(),attorney:z.string().nullable()})),
  people:z.array(z.object({name:z.string(),role:z.string(),confidence:z.enum(CONF)})).describe("People in business roles only (founder, officer, manager, filer)"),
  bbb_rating:z.string().nullable(),bbb_complaints:z.number().nullable(),
  lawsuits:z.array(z.object({title:z.string(),court:z.string().nullable(),case_no:z.string().nullable(),date:z.string().nullable(),status:z.string().nullable()})),
  regulatory:z.array(z.object({agency:z.string(),action:z.string(),date:z.string().nullable()})),
  risks:z.array(z.string()).describe("Short risk flags, e.g. 'persona/doctor ad pages', 'clone storefront', 'dissolved entity still selling'"),
  support_emails:z.array(z.string()).describe("Business support emails on the brand's own domain"),
  business_phones:z.array(z.string()),
  needs_deep_dive:z.boolean(),deep_dive_reason:z.string().nullable(),
 }),
});

// Structured profile from the model's output, in the app's Profile shape.
function toProfile(p:z.infer<typeof CaseSchema>["profile"]):import("./profile").Profile{
 return {
  identifiers:{supportEmails:p.support_emails,phones:p.business_phones},
  entities:p.entities.map(e=>({name:e.name,role:e.role,jurisdiction:e.jurisdiction,fileNumber:e.file_number,formed:e.formed,status:e.status||undefined,registeredAgent:e.registered_agent,confidence:e.confidence,source:e.source})),
  trademarks:p.trademarks.map(t=>({mark:t.mark,serial:t.serial,registration:t.registration,owner:t.owner,status:t.status||undefined,filed:t.filed,attorney:t.attorney})),
  people:p.people,
  network:p.network?{name:p.network}:undefined,
  reputation:{bbbRating:p.bbb_rating,bbbComplaints:p.bbb_complaints,lawsuits:p.lawsuits.map(l=>({title:l.title,court:l.court,caseNo:l.case_no,date:l.date,status:l.status})),regulatory:p.regulatory,risks:p.risks},
  research:{depth:"web",researchedAt:new Date().toISOString().slice(0,10),needsDeepDive:p.needs_deep_dive,deepDiveReason:p.deep_dive_reason,ownershipStatus:p.ownership_status,ownershipNote:p.ownership_note},
 };
}

export function aiResearchEnabled(){return Boolean(process.env.ANTHROPIC_API_KEY)}

type Source={url:string;title:string;snippet:string};

function collectSources(blocks:any[],into:Map<string,Source>){
 for(const b of blocks){
  if(b.type==="web_search_tool_result"&&Array.isArray(b.content))for(const r of b.content){if(r?.url&&!into.has(r.url))into.set(r.url,{url:r.url,title:r.title||r.url,snippet:r.page_age?`Page age: ${r.page_age}`:""})}
  if(b.type==="web_fetch_tool_result"&&b.content?.url&&!into.has(b.content.url))into.set(b.content.url,{url:b.content.url,title:b.content.content?.title||b.content.url,snippet:"Fetched page"});
  if(b.type==="text"&&Array.isArray(b.citations))for(const c of b.citations){if(c?.url){const s=into.get(c.url)||{url:c.url,title:c.title||c.url,snippet:""};if(c.cited_text&&s.snippet.length<600)s.snippet=(s.snippet?s.snippet+" … ":"")+c.cited_text.slice(0,300);into.set(c.url,s)}}
 }
}

class ClaudeResearchProvider implements ResearchProvider{
 name="ai_research";label="Web research (Claude)";
 supports(){return aiResearchEnabled()}
 async run(ctx:ProviderContext&{prelim?:string}):Promise<ProviderResult>{
  const client=new Anthropic();
  const sources=new Map<string,Source>();
  const seedLine=`Seed ${ctx.seedType}: ${ctx.seedValue}${ctx.domain&&ctx.domain!==ctx.seedValue?` (domain: ${ctx.domain})`:""}`;
  const messages:any[]=[{role:"user",content:`${seedLine}\n\nPreliminary findings already collected (verify, extend, do not just repeat):\n${ctx.prelim||"none"}\n\nInvestigate this seed and write the dossier.`}];
  const deadline=Date.now()+RESEARCH_DEADLINE_MS;
  let dossier="";
  await ctx.log("Claude is searching the web (trademarks, registries, press, complaints)…");
  for(let turn=0;turn<5&&Date.now()<deadline;turn++){
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(5000,deadline-Date.now()));
   const blocks:any[]=[];let stop:string|null=null;
   try{
    const stream=client.beta.messages.stream({
     model:MODEL,max_tokens:32000,
     betas:["server-side-fallback-2026-07-01"],fallbacks:"default",
     thinking:{type:"adaptive"},output_config:{effort:"high"},
     system:[{type:"text",text:SYSTEM,cache_control:{type:"ephemeral"}}],
     tools:[{type:"web_search_20260209",name:"web_search",max_uses:14},{type:"web_fetch_20260209",name:"web_fetch",max_uses:14,max_content_tokens:12000}] as any,
     messages,
    },{signal:controller.signal});
    stream.on("contentBlock",(b:any)=>{blocks.push(b);if(b.type==="web_search_tool_result"||b.type==="web_fetch_tool_result")collectSources([b],sources)});
    const msg=await stream.finalMessage();
    stop=msg.stop_reason;blocks.splice(0,blocks.length,...msg.content);
   }catch(e){
    if(!controller.signal.aborted)throw e;
    await ctx.log("Web research hit its time limit; building the case from what was found.");
   }finally{clearTimeout(timer)}
   collectSources(blocks,sources);
   dossier+=blocks.filter(b=>b.type==="text").map(b=>b.text).join("");
   if(stop==="refusal")throw new Error("The research model declined this request.");
   if(stop!=="pause_turn")break;
   messages.push({role:"assistant",content:blocks});
   await ctx.log(`Continuing web research (${sources.size} sources so far)…`);
  }
  if(!dossier.trim()&&!sources.size)return {findings:[],draft:emptyDraft(),notes:["Web research returned nothing."]};
  await ctx.log(`Structuring findings from ${sources.size} sources…`);
  const sourceList=[...sources.values()].slice(0,80).map(s=>`- ${s.url} — ${s.title}${s.snippet?` — ${s.snippet.slice(0,200)}`:""}`).join("\n");
  const parsed=await client.messages.parse({
   model:MODEL,max_tokens:16000,
   thinking:{type:"adaptive"},output_config:{effort:"medium",format:zodOutputFormat(CaseSchema)},
   system:"Convert an OSINT dossier into a case graph. Use only facts in the dossier. Nodes are only brands, people in business roles, companies, trademarks, domains, business addresses, business phones and business emails; put events (recalls, lawsuits, filings, articles) in the timeline and evidence instead, never as nodes. Never add relatives or private individuals, including excluded name collisions of people. The seed entity's node key must be \"seed\". Keep the dossier's confidence labels; never raise them. Every evidence url must be one of the listed sources or a URL quoted in the dossier. Leave out residential addresses and personal contact details. 6–25 nodes. Also fill the structured profile from the same facts (same confidence rules) and set store_domain when the dossier shows the brand sells on a different domain than the seed.",
   messages:[{role:"user",content:`${seedLine}\n\nDOSSIER:\n${dossier}\n\nSOURCES SEEN:\n${sourceList}`}],
  });
  const out=parsed.parsed_output;
  const draft=emptyDraft();
  if(out){
   const keyMap=new Map<string,string>();
   for(const n of out.nodes){
    const k=n.key==="seed"?addNode(draft,{key:"seed",type:ctx.seedType,label:ctx.seedValue,subtitle:n.subtitle,confidence:n.confidence,details:n.details}):addNode(draft,{type:n.type as NodeType,label:n.label,subtitle:n.subtitle,confidence:n.confidence,details:n.details});
    keyMap.set(n.key,k);
   }
   for(const e of out.edges){const f=keyMap.get(e.from),t=keyMap.get(e.to);if(f&&t)addEdge(draft,{from:f,to:t,label:e.label.toUpperCase(),confidence:e.confidence})}
   for(const e of out.evidence)if(/^https?:\/\//.test(e.url))addEvidence(draft,{title:e.title,source:e.url,confidence:e.confidence,note:e.note});
   draft.timeline=out.timeline.filter(t=>/^\d{4}/.test(t.date));
   draft.questions=out.open_questions.slice(0,6);
   draft.summary=out.summary;
   draft.category=out.category;
   draft.profile=toProfile(out.profile);
   draft.storeDomain=out.store_domain;
  }
  const findings:ProviderFinding[]=[
   {title:`Research dossier: ${ctx.seedValue}`,url:`claude-research://${encodeURIComponent(ctx.seedValue)}`,publisher:"Claude web research",snippet:dossier.slice(0,20000),sourceType:"ai_research",entities:draft.nodes.map(n=>({type:n.type,label:n.label,subtitle:n.subtitle})),claims:draft.edges.map(e=>({from:e.from,to:e.to,label:e.label,claim:`${e.from} ${e.label} ${e.to} (${e.confidence})`}))},
   ...[...sources.values()].slice(0,120).map(s=>({title:s.title,url:s.url,publisher:(()=>{try{return new URL(s.url).hostname}catch{return ""}})(),snippet:s.snippet,sourceType:"web" as const,entities:[],claims:[]})),
  ];
  return {findings,draft,notes:[`${sources.size} web sources, ${draft.nodes.length} entities, ${draft.edges.length} relationships`]};
 }
}

export const claudeResearch=new ClaudeResearchProvider();
export type {Draft};
