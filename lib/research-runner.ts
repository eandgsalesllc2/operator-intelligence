import {Case,NodeType} from "./types";
import {certs,firstParty,portfolio,providers,ProviderContext,ProviderFinding} from "./providers";
import {aiResearchEnabled,claudeResearch,writeStrategy} from "./ai-research";
import {pullMarketing} from "./marketing-sources";
import {subscriptionFor} from "./metrics";
import {detectSellingPlans} from "./selling-plans";
import {detectChannels} from "./channels";
import {Draft,layout,mergeDraft} from "./case-builder";
import {cleanDomain,isPublicHostname} from "./net";
import {getInvestigation,matchIdentifiers,saveInvestigation,saveProviderFindings,updateResearchJob} from "./repository";
import {identifierRows,KIND_LABEL,STRONG_KINDS,type Profile} from "./profile";
import {addEdge,addEvidence,addNode,emptyDraft} from "./case-builder";

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
 const domain=seedType==="domain"?seedValue:(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(seedValue)?.[1]||"").toLowerCase().replace(/^www\./,"");
 const label=name?.trim()||seedValue;
 const today=new Date().toISOString().slice(0,10);
 return {id,name:label,domain,status:"Research running",summary:`Investigation seeded from ${seedType}: ${seedValue}.`,nodes:[{id:id+":seed",label:seedValue,type:seedType,subtitle:"Investigation seed",x:380,y:230,confidence:"lead",details:["Research seed"]}],edges:[],evidence:[],timeline:[{date:today,title:"Investigation created",body:`Seeded from ${seedType}: ${seedValue}.`}],openQuestions:[]};
}

function domainFor(c:Case,seedValue:string,seedType:NodeType){
 if(seedType==="domain")return cleanDomain(seedValue);
 if(seedType==="email"&&!FREE_MAIL.test(seedValue))return seedValue.split("@")[1].toLowerCase();
 if(seedType==="brand"&&c.domain&&c.name.toLowerCase()===seedValue.toLowerCase())return cleanDomain(c.domain);
 // "Kaori (try-kaori.com)" — a brand or company label with its domain written in it
 const inLabel=/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(seedValue)?.[1];
 if((seedType==="brand"||seedType==="company")&&inLabel&&isPublicHostname(cleanDomain(inLabel)))return cleanDomain(inLabel);
 if(c.domain)return cleanDomain(c.domain);
 return "";
}

// Fold a research profile into the stored one: keep what is already known, add what is new.
function mergeProfile(base:Profile,add?:Profile):Profile{
 if(!add)return base;
 const uniq=<T,>(a:T[]|undefined,b:T[]|undefined,key:(x:T)=>string)=>{const m=new Map<string,T>();for(const x of [...(a||[]),...(b||[])]){const k=key(x).toLowerCase();if(k&&!m.has(k))m.set(k,x)}return [...m.values()]};
 const ids={...(base.identifiers||{})} as any;
 for(const [k,v] of Object.entries(add.identifiers||{}))if(Array.isArray(v))ids[k]=[...new Set([...(ids[k]||[]),...v])];else if(v&&!ids[k])ids[k]=v;
 const r0=base.reputation||{},r1=add.reputation||{};
 const deep=base.research?.depth==="deep";
 return {...base,identifiers:ids,
  entities:uniq(base.entities,add.entities,e=>e.name),
  trademarks:uniq(base.trademarks,add.trademarks,t=>t.serial||t.mark),
  people:uniq(base.people,add.people,p=>p.name),
  network:base.network?.name||base.network?.parent?base.network:add.network,
  reputation:{...r0,bbbRating:r0.bbbRating??r1.bbbRating,bbbComplaints:r0.bbbComplaints??r1.bbbComplaints,
   lawsuits:uniq(r0.lawsuits,r1.lawsuits,l=>l.caseNo||l.title),regulatory:uniq(r0.regulatory,r1.regulatory,x=>x.agency+x.action),risks:[...new Set([...(r0.risks||[]),...(r1.risks||[])])]},
  research:deep?base.research:{...(base.research||{}),...(add.research||{}),blocked:base.research?.blocked},
 };
}

function prelimSummary(d:Draft){
 const lines=d.nodes.filter(n=>n.key!=="seed").slice(0,30).map(n=>`- ${n.type}: ${n.label} (${n.confidence}) — ${n.subtitle}${n.details.length?"; "+n.details.slice(0,3).join("; "):""}`);
 const ev=d.evidence.slice(0,15).map(e=>`- ${e.title}: ${e.source} — ${e.note.slice(0,200)}`);
 return [...lines,...(ev.length?["Sources:",...ev]:[])].join("\n");
}

// Plain-language summary built from the graph when no research model wrote one.
function describe(c:Case,seedId:string,seedValue:string){
 const name=(id:string)=>c.nodes.find(n=>n.id===id)?.label||"";
 const touching=c.edges.filter(e=>e.from===seedId||e.to===seedId);
 const owners=touching.filter(e=>["LEGAL OWNER","OPERATES","IP OWNER","TRADEMARK OWNER","OWNS"].includes(e.label)&&e.to===seedId&&(e.confidence==="confirmed"||e.confidence==="strong")).map(e=>`${name(e.from)} (${e.label.toLowerCase()}, ${e.confidence})`);
 const cases=c.nodes.filter(n=>n.subtitle.startsWith("Existing investigation")&&n.confidence!=="excluded");
 const parts:string[]=[];
 if(owners.length)parts.push(`${seedValue}: ${owners.slice(0,3).join("; ")}.`);
 if(cases.length){
  const links=cases.slice(0,6).map(n=>{const e=c.edges.find(e=>e.to===n.id);return `${n.label}${e?` (${e.label.toLowerCase()}, ${e.confidence})`:""}`});
  parts.push(`Linked to ${cases.length} existing investigation${cases.length>1?"s":""}: ${links.join(", ")}.`);
 }
 const shared=touching.filter(e=>e.label.startsWith("SHARED")).length;
 if(shared)parts.push(`${shared} contact or infrastructure identifiers recorded for pivoting.`);
 if(!parts.length)parts.push(`No ownership evidence found yet for ${seedValue}.`);
 parts.push("Shared addresses, vendors and templates are correlation, not proof of ownership.");
 return parts.join(" ");
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
  // Traffic, ads and landing pages (BrandSearch + Atria) run alongside everything else.
  const brandName=/\.[a-z]{2,}$/i.test(c.name)?"":c.name;
  const marketingP=domain?pullMarketing(domain,brandName).catch(()=>null):Promise.resolve(null);
  const plansP=domain?detectSellingPlans(domain).catch(()=>null):Promise.resolve(null);
  const channelsP=domain?detectChannels(domain).catch(()=>null):Promise.resolve(null);
  const active=providers.filter(p=>p.supports(ctx));
  const drafts:Draft[]=[];const notes:string[]=[];let findingsTotal=0;const found:NonNullable<Profile["identifiers"]>[]=[];
  let done=0;
  await Promise.all(active.map(async p=>{
   try{
    const r=await p.run(ctx);
    drafts.push(r.draft);notes.push(`${p.label}: ${r.notes.join("; ")}`);if(r.identifiers)found.push(r.identifiers);
    if(r.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:p.name,findings:r.findings});findingsTotal+=r.findings.length}
   }catch(e){notes.push(`${p.label}: failed — ${e instanceof Error?e.message:"error"}`)}
   done++;await log(`${p.label} done (${done}/${active.length})`,10+Math.round(done/active.length*(aiResearchEnabled()?30:80)));
  }));
  // Second pass: look up what the site revealed (companies, people, emails, phones) in other investigations.
  const discovered=drafts.flatMap(d=>d.nodes).filter(n=>n.key!=="seed"&&["company","person","email"].includes(n.type)&&n.confidence!=="lead"&&n.confidence!=="excluded").slice(0,8);
  if(discovered.length){
   try{const r=await portfolio.runTerms(ctx,discovered.map(n=>({term:n.type==="company"?n.label.replace(/,?\s+(L\.?L\.?C\.?|Inc\.?|Incorporated|Corp\.?|Corporation|Ltd\.?|Limited|GmbH|B\.V\.|PBC|LLP|UAB)\.?$/i,""):n.label,from:n.key})));
    for(const n of discovered)r.draft.nodes.push({...n});drafts.push(r.draft);notes.push(`Cross-investigation links: ${r.notes.join("; ")}`);
    if(r.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:"portfolio",findings:r.findings});findingsTotal+=r.findings.length}}
   catch(e){notes.push(`Cross-investigation links: failed — ${e instanceof Error?e.message:"error"}`)}
  }
  // Merge discovered identifiers into the profile, then link investigations that share them.
  const profile:Profile={...(c.profile||{}),identifiers:{...(c.profile?.identifiers||{})}};
  for(const f of found)for(const [k,v] of Object.entries(f)){const cur=(profile.identifiers as any)[k];if(Array.isArray(v))(profile.identifiers as any)[k]=[...new Set([...(cur||[]),...v])];else if(v&&!cur)(profile.identifiers as any)[k]=v}
  try{
   const ms=(await matchIdentifiers(identifierRows(profile).map(r=>r.normalized),c.id)).filter(m=>STRONG_KINDS.has(m.kind)&&m.kind!=="attorney");
   if(ms.length){const d=emptyDraft();const seen=new Set<string>();
    for(const m of ms){if(seen.has(m.investigation_id+m.kind))continue;seen.add(m.investigation_id+m.kind);
     const k=addNode(d,{type:"brand",label:m.name,subtitle:`Existing investigation · ${m.domain||m.investigation_id}`,confidence:"strong",details:[`Shares ${KIND_LABEL[m.kind]||m.kind}: ${m.value}`]});
     addEdge(d,{from:"seed",to:k,label:"SHARED INFRASTRUCTURE",confidence:["company","person","trademark_serial"].includes(m.kind)?"strong":"correlation"});
     addEvidence(d,{title:`Shared ${KIND_LABEL[m.kind]||m.kind} with ${m.name}`,source:`/investigations/${m.investigation_id}`,confidence:"correlation",note:`${m.value} appears on both. Shared tracking IDs, accounts and contacts point to a common operator; confirm with registry or trademark records.`})}
    drafts.push(d);notes.push(`Identifier matches: ${new Set(ms.map(m=>m.investigation_id)).size} investigations`)}
  }catch(e){notes.push("Identifier matching failed: "+(e instanceof Error?e.message:"error"))}
  // Companies the brand's own pages name go into the profile too. A name that only appears in a copyright line is a lead, not a seller of record.
  const siteCos=drafts.flatMap(d=>d.nodes).filter(n=>n.type==="company"&&/named on site$/.test(n.subtitle));
  if(siteCos.length){
   const known=new Set((profile.entities||[]).map(e=>e.name.toLowerCase()));
   profile.entities=[...(profile.entities||[]),...siteCos.filter(n=>!known.has(n.label.toLowerCase())).map(n=>{
    const roles=(/as: (.*)$/.exec(n.details[0]||"")?.[1]||"").toLowerCase();
    const seller=/seller|operat|owned|merchant|provider|company|d\/b\/a|dba|terms/.test(roles);
    return {name:n.label,role:"legal seller",confidence:(seller&&n.subtitle.startsWith("Legal")?"strong":"lead") as any,source:null,status:seller?undefined:"named only in a copyright or brand line on the site; not verified in a registry"};
   })];
  }
  let merged:Case={...c,profile};
  for(const d of drafts)merged=mergeDraft(merged,d,seedNode.id);
  let aiError="";let storeDomain="";
  if(aiResearchEnabled()){
   await log("Starting web research",45);
   const pre={nodes:drafts.flatMap(d=>d.nodes),evidence:drafts.flatMap(d=>d.evidence)} as Draft;
   try{
    const r=await claudeResearch.run({...ctx,log:(m:string)=>log(m),prelim:prelimSummary(pre)} as any);
    notes.push(`${claudeResearch.label}: ${r.notes.join("; ")}`);
    if(r.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:claudeResearch.name,findings:r.findings as ProviderFinding[]});findingsTotal+=r.findings.length}
    merged=mergeDraft(merged,r.draft,seedNode.id);
    merged={...merged,profile:mergeProfile(merged.profile||{},r.draft.profile)};
    // A case created from a bare domain takes the brand name research found (e.g. ryzesuperfoods.com → RYZE).
    if(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(merged.name)){const b=r.draft.nodes.find(n=>n.type==="brand"&&(n.confidence==="confirmed"||n.confidence==="strong")&&!/\.[a-z]{2,}$/i.test(n.label));if(b)merged={...merged,name:b.label.replace(/\s*\(.*\)$/,"").slice(0,80)}}
    // The brand sells on a different domain than the one searched (e.g. rhode.com → rhodeskin.com): scan the real store too.
    const store=r.draft.storeDomain?cleanDomain(r.draft.storeDomain):"";
    if(store&&isPublicHostname(store)&&store!==domain&&!store.endsWith("."+domain)){
     await log(`Scanning the brand's store domain ${store}`,85);
     const sctx:ProviderContext={...ctx,seedType:"brand",domain:store};
     for(const p of [firstParty,certs]){
      try{const sr=await p.run(sctx);merged=mergeDraft(merged,sr.draft,seedNode.id);notes.push(`${p.label} (${store}): ${sr.notes.join("; ")}`);
       if(sr.identifiers)merged={...merged,profile:mergeProfile(merged.profile||{},{identifiers:sr.identifiers})};
       if(sr.findings.length){await saveProviderFindings({investigationId:c.id,jobId:job.id,provider:p.name,findings:sr.findings});findingsTotal+=sr.findings.length}}
      catch(e){notes.push(`${p.label} (${store}): failed — ${e instanceof Error?e.message:"error"}`)}
     }
     if(!c.domain||cleanDomain(c.domain)===domain){merged={...merged,domain:store};notes.push(`Store domain is ${store}; the investigation now uses it.`)}
     storeDomain=store;
    }
   }catch(e){aiError=e instanceof Error?e.message:"error";notes.push(`${claudeResearch.label}: failed — ${aiError}`);console.error("web research failed",e)}
  }
  // Marketing: prefer the store domain's data when research found a different store.
  try{
   await log("Adding traffic, ads and landing pages",92);
   let mp=await marketingP;
   let plans=await plansP;if(storeDomain&&!plans)plans=await detectSellingPlans(storeDomain).catch(()=>null);
   if(plans)merged={...merged,profile:{...(merged.profile||{}),identifiers:{...(merged.profile?.identifiers||{}),sellingPlans:plans}}};
   const empty=(x:typeof mp)=>!x||(x.metrics?.monthlyVisits==null&&!x.marketing?.landing?.landingPages?.length);
   if(storeDomain){const sp=await pullMarketing(storeDomain,brandName).catch(()=>null);if(!empty(sp))mp=sp}
   for(const r of mp?.reports||[])notes.push(`${r.source==="brandsearch"?"BrandSearch":"Atria"}: ${r.note}`);
   if(mp?.marketing){
    const m={...(merged.marketing||{}),...mp.marketing};
    if(m.meta||m.landing||m.tiktok||m.email){
     const strategy=await writeStrategy(merged.name,{meta:m.meta,tiktok:m.tiktok,instagram:m.instagram,email:m.email,landing:m.landing&&{kindMix:m.landing.kindMix,hosts:m.landing.hosts,pages:m.landing.landingPages?.slice(0,12).map(l=>({path:(l.host||"")+(l.path||""),kind:l.kind,ads:l.activeAds,headline:l.headline,runBy:l.pages}))},topCopy:(mp as any).topCopy}).catch(()=>null);
     if(strategy)m.strategy=strategy;
    }
    merged={...merged,marketing:m};
   }
   let scan=await channelsP;if(storeDomain&&!scan)scan=await detectChannels(storeDomain).catch(()=>null);
   if(scan)merged={...merged,marketing:{...(merged.marketing||{}),channelScan:scan}};
   if(mp?.metrics?.monthlyVisits!=null||(mp?.metrics&&!merged.metrics?.monthlyVisits)){
    const met=mp!.metrics!;
    merged={...merged,metrics:{...met,subscription:subscriptionFor(met,merged.profile?.identifiers?.subscriptionApp,merged.marketing?.strategy?.offers,merged.profile?.identifiers?.sellingPlans,merged.profile?.identifiers?.subscriptionOverride)}};
   }
   if(merged.metrics&&merged.profile?.identifiers?.sellingPlans,merged.profile?.identifiers?.subscriptionOverride)merged={...merged,metrics:{...merged.metrics,subscription:subscriptionFor(merged.metrics,merged.profile?.identifiers?.subscriptionApp,merged.marketing?.strategy?.offers,merged.profile.identifiers.sellingPlans,merged.profile.identifiers.subscriptionOverride)}};
  }catch(e){notes.push("Marketing data failed: "+(e instanceof Error?e.message:"error"))}
  if(!aiResearchEnabled()||merged.summary===c.summary)merged={...merged,summary:describe(merged,seedNode.id,job.seed_value)};
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
  const message=empty?"No sources found. "+notes.join(" | "):aiError?`Partial research · web research failed (${aiError.slice(0,160)}) · ${added} new entities from the site and registries`:`Research complete · ${added} new entities · ${newEvidence} new evidence · ${findingsTotal} sources`;
  return await updateResearchJob(job.id,{status:empty?"failed":"completed",provider:"multi",progress:100,message:message.slice(0,1000),error:empty?"Nothing was collected":"",completed_at:new Date().toISOString()});
 }catch(error){
  const message=error instanceof Error?error.message:"Research failed";
  await updateResearchJob(job.id,{status:"failed",message:"Research failed: "+message,error:message,progress:100,completed_at:new Date().toISOString()}).catch(()=>{});
  return null;
 }
}
