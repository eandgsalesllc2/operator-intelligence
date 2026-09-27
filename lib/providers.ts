import {NodeType} from "./types";
import {Draft,addEdge,addEvidence,addNode,emptyDraft,keyFor} from "./case-builder";
import {cleanDomain,isPublicHostname,safeFetch} from "./net";
import {searchPortfolio} from "./repository";
import type {Profile} from "./profile";

export type ProviderFinding={
 title:string;
 url:string;
 publisher:string;
 snippet:string;
 sourceType:"first_party"|"registry"|"trademark"|"web"|"infrastructure"|"portfolio"|"ai_research";
 entities:Array<{type:NodeType;label:string;subtitle:string}>;
 claims:Array<{from?:string;to?:string;label:string;claim:string}>;
};
export type ProviderResult={findings:ProviderFinding[];draft:Draft;notes:string[];identifiers?:NonNullable<Profile["identifiers"]>};
export type ProviderContext={seedValue:string;seedType:NodeType;domain:string;investigationId:string;log:(msg:string)=>Promise<void>};

export interface ResearchProvider{
 name:string;
 label:string;
 supports(ctx:ProviderContext):boolean;
 run(ctx:ProviderContext):Promise<ProviderResult>;
}

const decode=(s:string)=>s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;|&#x27;|&rsquo;/gi,"'").replace(/&quot;/gi,'"').replace(/&copy;/gi,"©").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
export const textFromHtml=(html:string)=>decode(html
 .replace(/<script[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style[^>]*>[\s\S]*?<\/style>/gi," ")
 .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi," ")
 .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi,"\n")
 .replace(/<[^>]+>/g," "))
 .replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim();

// ---------- first-party extraction ----------

const SUFFIX="(?:L\\.?L\\.?C\\.?|Inc\\.?|Incorporated|Corp\\.?|Corporation|Ltd\\.?|Limited|GmbH|B\\.V\\.|PBC|L\\.?P\\.|LLP|Pty\\.? Ltd\\.?|UAB|S\\.A\\.|SAS|Co\\., Ltd\\.?)";
const NAME="[A-Z0-9][\\w&'’.-]*(?:\\s+(?:&\\s+)?[A-Z0-9][\\w&'’.-]*){0,6}";
const ENTITY_RE=new RegExp(`\\b(${NAME},?\\s+${SUFFIX})(?![\\w])`,"g");
const DBA_RE=new RegExp(`(${NAME},?\\s+${SUFFIX}),?\\s*\\(?\\s*(?:[dD]\\/[bB]\\/[aA]|dba|DBA|doing business as|trading as)\\s+["“]?([A-Z][\\w&'’ -]{1,40}?)["”]?(?=[\\s,.;)]|$)`,"g");
const OPERATED_RE=new RegExp(`(?:operated|owned|provided|run|managed|controlled)\\s+(?:and\\s+(?:operated|owned)\\s+)?by\\s+(?:the\\s+)?(${NAME},?\\s+${SUFFIX})`,"g");
const COPYRIGHT_RE=/(?:©|Copyright)\s*(?:\(c\)\s*)?(?:\d{4}\s*(?:[-–]\s*\d{4})?\s*,?\s*)?([A-Z][\w&'’. -]{1,60}?)(?:\.\s|\s*All rights|\s*\||\s*Powered|$)/gm;
const EMAIL_RE=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const PHONE_RE=/(?:\+1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\+(?!1\b)\d{2,3}[\s.-]?\d{1,4}(?:[\s.-]?\d{2,4}){2,4}/g;
const STREET="(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Hwy|Highway|Pkwy|Parkway|Ct|Court|Pl|Place|Sq|Square|Cir|Circle|Ter|Terrace|Trl|Trail|Plaza|Green|Center|Centre)";
const ADDRESS_RE=new RegExp(`\\b\\d{1,6}[A-Z]?\\s+(?:[NSEW]\\.?\\s+)?[A-Z0-9][\\w.'’ -]{1,40}?\\s${STREET}\\.?(?:,?\\s*(?:Suite|Ste\\.?|Unit|Apt\\.?|#|PMB|Box)\\s*[\\w-]+)*,?\\s+[A-Z][A-Za-z .'-]{1,30},?\\s+(?:[A-Z]{2}|Alabama|Alaska|Arizona|California|Colorado|Delaware|Florida|Georgia|Nevada|New York|Texas|Utah|Wyoming|Illinois|New Jersey)\\s+\\d{5}(?:-\\d{4})?`,"g");

// Addresses used by registered-agent / virtual-office services for thousands of companies.
const MASS_ADDRESSES=[/30 (N\.?|North) Gould/i,/1309 Coffeen/i,/(312|311) W(\.|est)? 2nd/i,/1309 Coffeen/i,/312 W\.? 2nd/i,/3140 W\.? Main/i,/525 Randall/i,/1603 Capitol/i,/8 The Green/i,/254 Chapman/i,/131 Continental/i,/2810 N\.? Church/i,/1021 E\.? Lincolnway/i,/1023 E\.? Lincolnway/i,/5830 E\.? 2nd/i,/1621 Central/i,/2035 Sunset Lake/i,/1000 N\.? West St/i,/3411 Silverside/i,/16192 Coastal/i,/4008 Laramie/i,/1712 Pioneer/i,/701 Tillery/i,/30 N\.? Gould/i,/1013 Centre Rd/i,/2140 S\.? Dupont/i,/651 N\.? Broad/i];
const VENDOR_ENTITIES=/^(shopify|google|meta platforms|facebook|klaviyo|stripe|paypal|apple|amazon|microsoft|recharge|loop|attentive|postscript|gorgias|yotpo|okendo|judge\.me|american arbitration|jams|visa|mastercard|american express|the ups store|federal express|fedex|ups|usps|dhl|cloudflare|vercel|twitter|x corp|tiktok|pinterest|snap|linkedin|youtube|affirm|klarna|afterpay|sezzle|shop pay|zendesk|triple whale|northbeam|appstle|skio|bold commerce|checkoutchamp|funnelish|samcart|clickfunnels|salesforce|hubspot|intercom|oracle|adobe)\b/i;
const CHECKOUT_VENDORS:[RegExp,string][]=[[/checkoutchamp|konnektive/i,"CheckoutChamp"],[/funnelish/i,"Funnelish"],[/ecommcheckout|ptsccb/i,"Phoenix Technologies"],[/lassocommerce|lasso_sid|lassocart/i,"Lasso"],[/rechargeapps|rechargepayments/i,"Recharge"],[/samcart/i,"SamCart"],[/loopsubscriptions|loop-subscriptions/i,"Loop Subscriptions"],[/appstle/i,"Appstle"],[/skio\.com/i,"Skio"],[/whop\.com/i,"Whop"],[/ultracart/i,"UltraCart"],[/clickfunnels/i,"ClickFunnels"]];

const tidy=(s:string)=>s.replace(/\s+/g," ").replace(/^[,.;:\s"“]+|[,;:\s"”]+$/g,"").trim();
// Regex matches often drag in navigation or sentence words ahead of the name; keep the name only.
const LEAD_WORDS=new Set(["faq","search","login","log","in","cart","contact","contacts","home","shop","menu","account","website","site","store","about","us","terms","privacy","policy","policies","copyright","all","rights","reserved","by","the","is","are","operated","owned","and","of","to","from","with","our","this","these","company","legal","notice","refund","shipping","support","help","service","services","customer","email","phone","address","mailing","registered","office","name","info","information","welcome","skip","content","close","open","sign","track","order","orders","your","you","we","its","their","for","a","an","on","at","as","or","be","which","that","who","get","buy","now","new","sale","free","official","©"]);
function cleanEntity(raw:string){
 let s=tidy(raw).replace(/[©®™]/g," ");
 const cut=Math.max(s.lastIndexOf(". "),s.lastIndexOf(": "),s.lastIndexOf("|"),s.lastIndexOf("•"),s.lastIndexOf(" - "));
 if(cut>=0)s=s.slice(cut+1).replace(/^[\s.:|•-]+/,"");
 const w=s.split(/\s+/);
 while(w.length>2&&/^[A-Z]{3,}$/.test(w[0])&&/^[A-Z][a-z]/.test(w[1]))w.shift();
 while(w.length>2&&(LEAD_WORDS.has(w[0].toLowerCase().replace(/[^a-z©]/g,""))||/^[a-z]/.test(w[0])||/^\d{4}$/.test(w[0])))w.shift();
 return tidy(w.join(" "));
}
const isJunkEntity=(s:string)=>s.length<5||s.split(" ").length>9||VENDOR_ENTITIES.test(s)||/^(the|this|our|your|such|any|all|each|an?|if|by|of|to|in|and|or|for|with|company|website|site|store|we|us)\s/i.test(s)||/\b(terms|policy|privacy|agreement|section|clause)\b/i.test(s);

type PageHit={url:string;path:string;html:string;text:string};

const PAGES=["/","/policies/terms-of-service","/policies/privacy-policy","/policies/refund-policy","/policies/shipping-policy","/policies/contact-information","/policies/legal-notice","/pages/contact","/pages/contact-us","/pages/about","/pages/about-us","/pages/terms","/pages/terms-of-service","/pages/terms-and-conditions","/pages/privacy-policy","/terms","/privacy","/contact","/about"];

async function fetchPages(domain:string,log:ProviderContext["log"]){
 const hits:PageHit[]=[];const errors:string[]=[];const seen=new Set<string>();
 const queue=[...PAGES];
 await Promise.all(Array.from({length:4},async()=>{
  while(queue.length){
   const path=queue.shift()!;
   try{
    const r=await safeFetch("https://"+domain+path,{timeoutMs:12000});
    if(r.status>=400){if(path==="/")errors.push(`${path}: HTTP ${r.status}`);continue}
    if(!r.contentType.includes("html"))continue;
    const finalUrl=r.url.replace(/[?#].*$/,"");
    if(seen.has(finalUrl))continue;seen.add(finalUrl);
    const text=textFromHtml(r.body);
    if(text.length<60)continue;
    hits.push({url:finalUrl,path,html:r.body,text});
   }catch(e){errors.push(`${path}: ${e instanceof Error?e.message:"fetch failed"}`)}
  }
 }));
 await log(`Fetched ${hits.length} first-party pages from ${domain}`);
 return {hits,errors};
}

function pageTitle(h:PageHit){const t=/<title[^>]*>([^<]{1,120})<\/title>/i.exec(h.html);return decode(t?.[1]?.trim()||h.path)}

class FirstPartyProvider implements ResearchProvider{
 name="first_party";label="Website & legal pages";
 supports(ctx:ProviderContext){return isPublicHostname(ctx.domain)}
 async run(ctx:ProviderContext):Promise<ProviderResult>{
  const {hits,errors}=await fetchPages(ctx.domain,ctx.log);
  const d=emptyDraft();const findings:ProviderFinding[]=[];const notes=[...errors.slice(0,6)];
  if(!hits.length){notes.push("No first-party pages could be fetched (site blocked, offline or rate-limited).");return {findings,draft:d,notes}}
  const domainKey=ctx.seedType==="domain"?"seed":addNode(d,{type:"domain",label:ctx.domain,subtitle:"Brand website",confidence:"confirmed",details:["Fetched directly"]});
  if(ctx.seedType!=="domain")addEdge(d,{from:"seed",to:domainKey,label:"OPERATES",confidence:"strong"});
  const entityScore=new Map<string,{label:string;score:number;roles:Set<string>;urls:Set<string>;quote:string}>();
  const bump=(label:string,score:number,role:string,url:string,quote:string)=>{
   label=cleanEntity(label);if(isJunkEntity(label))return;
   const k=keyFor("company",label);const e=entityScore.get(k)||{label,score:0,roles:new Set<string>(),urls:new Set<string>(),quote};
   e.score+=score;e.roles.add(role);e.urls.add(url);if(score>=3)e.quote=quote;entityScore.set(k,e);
  };
  const emails=new Map<string,string>(),phones=new Map<string,string>(),addresses=new Map<string,string>(),dbas=new Map<string,string>();
  const ids=new Set<string>();let shop="";const vendors=new Set<string>();const subdomains=new Set<string>();

  for(const h of hits){
   const legal=/terms|privacy|legal|refund|shipping|contact/.test(h.path);
   const snippetAround=(i:number)=>h.text.slice(Math.max(0,i-120),i+200).replace(/\s+/g," ");
   for(const m of h.text.matchAll(DBA_RE)){bump(m[1],5,"d/b/a "+tidy(m[2]),h.url,snippetAround(m.index||0));dbas.set(keyFor("company",cleanEntity(m[1])),tidy(m[2]))}
   for(const m of h.text.matchAll(OPERATED_RE))bump(m[1],5,"operator",h.url,snippetAround(m.index||0));
   for(const m of h.text.matchAll(ENTITY_RE))bump(m[1],legal?1:0.5,"named",h.url,snippetAround(m.index||0));
   for(const m of h.text.matchAll(COPYRIGHT_RE)){const n=tidy(m[1]);if(new RegExp(SUFFIX+"$").test(n))bump(n,3,"copyright holder",h.url,snippetAround(m.index||0))}
   for(const m of h.text.matchAll(EMAIL_RE)){const e=m[0].toLowerCase();if(/\.(png|jpe?g|gif|webp|svg)$|sentry|example\.|wixpress|@2x|u003e/.test(e))continue;if(!emails.has(e))emails.set(e,h.url)}
   if(legal)for(const m of h.text.matchAll(PHONE_RE)){const p=m[0].trim();const digits=p.replace(/\D/g,"");if(digits.length<10||/^(\d)\1+$/.test(digits))continue;if(!phones.has(digits))phones.set(digits,p+"|"+h.url)}
   for(const m of h.text.matchAll(ADDRESS_RE)){const a=tidy(m[0]);const k=keyFor("address",a);if(!addresses.has(k))addresses.set(k,a+"|"+h.url)}
   const raw=h.html;
   for(const re of [/\bGTM-[A-Z0-9]{5,9}\b/g,/\bG-[A-Z0-9]{8,12}\b/g,/\bAW-\d{8,12}\b/g,/\bUA-\d{4,10}-\d{1,3}\b/g])for(const m of raw.matchAll(re))ids.add(m[0]);
   for(const m of raw.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/g))ids.add("Meta pixel "+m[1]);
   for(const m of raw.matchAll(/clarity\.ms\/tag\/([a-z0-9]{8,12})/g))ids.add("Clarity "+m[1]);
   for(const m of raw.matchAll(/klaviyo\.com\/onsite\/js\/(?:klaviyo\.js\?company_id=)?([A-Za-z0-9]{6})\b/g))ids.add("Klaviyo "+m[1]);
   const s=/([a-z0-9][a-z0-9-]{1,60})\.myshopify\.com/.exec(raw);if(s&&!shop)shop=s[1];
   for(const [re,name] of CHECKOUT_VENDORS)if(re.test(raw))vendors.add(name);
   const base=ctx.domain.replace(/\./g,"\\.");
   for(const m of raw.matchAll(new RegExp(`https?://([a-z0-9-]+)\\.${base}`,"gi"))){const sub=m[1].toLowerCase();if(!["www","cdn","static","assets","images","img"].includes(sub))subdomains.add(sub+"."+ctx.domain)}
   findings.push({title:pageTitle(h),url:h.url,publisher:ctx.domain,snippet:h.text.slice(0,4000),sourceType:"first_party",entities:[],claims:[]});
  }

  // Fold "X Acme LLC" into "Acme LLC" when both were captured.
  const all=[...entityScore.values()];
  for(const a of all)for(const b of all)if(a!==b&&a.score>0&&b.score>0&&a.label.length>b.label.length&&a.label.endsWith(" "+b.label)){b.score+=a.score;a.roles.forEach(r=>b.roles.add(r));a.urls.forEach(u=>b.urls.add(u));a.score=0}
  const ranked=all.filter(e=>e.score>0).sort((a,b)=>b.score-a.score).slice(0,6);
  ranked.forEach((e,i)=>{
   const strong=e.score>=3;const conf=strong?"confirmed":e.score>=1.5?"strong":"lead";
   const roles=[...e.roles];const dba=dbas.get(keyFor("company",e.label));
   const k=addNode(d,{type:"company",label:e.label,subtitle:strong?"Legal entity named on site":"Company named on site",confidence:conf,details:[`Named on ${[...e.urls].length} first-party page(s) as: ${roles.join(", ")}`,...(dba?[`d/b/a ${dba}`]:[])]});
   addEdge(d,{from:k,to:"seed",label:strong?(i===0?"LEGAL OWNER":"OPERATES"):"PIVOT / INVESTIGATE",confidence:strong?"confirmed":"lead"});
   addEvidence(d,{title:`${e.label} named on ${ctx.domain}`,source:[...e.urls][0],confidence:conf,note:`Role on page: ${roles.join(", ")}. Context: “${e.quote.slice(0,260)}”`});
   findings[0].entities.push({type:"company",label:e.label,subtitle:roles.join(", ")});
  });
  const brandDomain=(e:string)=>e.split("@")[1]===ctx.domain||e.split("@")[1]?.endsWith("."+ctx.domain);
  for(const [e,url] of [...emails].slice(0,6)){
   const own=brandDomain(e);
   const k=addNode(d,{type:"email",label:e,subtitle:own?"Support email (brand domain)":"Email listed on site",confidence:"confirmed",details:[`Listed on ${url}`]});
   addEdge(d,{from:"seed",to:k,label:own?"SHARED EMAIL":"PIVOT / INVESTIGATE",confidence:own?"confirmed":"lead"});
   addEvidence(d,{title:`Email ${e}`,source:url,confidence:"confirmed",note:"Email address published on the first-party site."});
  }
  for(const [digits,v] of [...phones].slice(0,4)){
   const [p,url]=v.split("|");
   const k=addNode(d,{type:"phone",label:p,subtitle:"Phone listed on legal/contact page",confidence:"confirmed",details:[`Listed on ${url}`,`Normalized: ${digits}`]});
   addEdge(d,{from:"seed",to:k,label:"SHARED PHONE",confidence:"confirmed"});
   addEvidence(d,{title:`Phone ${p}`,source:url,confidence:"confirmed",note:"Phone number published on a first-party legal or contact page. Shared phones are correlation, not ownership."});
  }
  for(const v of [...addresses.values()].slice(0,5)){
   const [a,url]=v.split("|");const mass=MASS_ADDRESSES.some(re=>re.test(a));
   const k=addNode(d,{type:"address",label:a,subtitle:mass?"Registered-agent / virtual-office address":"Address listed on site",confidence:mass?"correlation":"confirmed",details:[`Listed on ${url}`,...(mass?["Used by many unrelated companies; not evidence of ownership"]:[])]});
   addEdge(d,{from:"seed",to:k,label:"SHARED ADDRESS",confidence:mass?"correlation":"confirmed"});
   addEvidence(d,{title:`Address ${a}`,source:url,confidence:mass?"correlation":"confirmed",note:mass?"Known mass registered-agent address.":"Address published on a first-party page."});
  }
  for(const sub of [...subdomains].filter(x=>/^(checkout|get|pay|secure|shop|store|offer|offers|buy|try|go|lp|order|orders|funnel|join|start|special|deals?|help|support)\./.test(x)).slice(0,6)){
   const k=addNode(d,{type:"domain",label:sub,subtitle:/checkout|pay|secure|get|buy|order/.test(sub)?"Checkout / funnel subdomain":"Subdomain",confidence:"confirmed",details:["Linked from the storefront"]});
   addEdge(d,{from:"seed",to:k,label:"SHARED INFRASTRUCTURE",confidence:"confirmed"});
  }
  const infra=[...(shop?[`Shopify store ${shop}.myshopify.com`]:[]),...ids,...[...vendors].map(v=>`Vendor: ${v}`)];
  if(infra.length){
   const target=d.nodes.find(n=>n.key===domainKey);
   if(target)target.details.push(...infra.map(s=>"Infrastructure: "+s));else addNode(d,{key:"seed",type:ctx.seedType,label:ctx.seedValue,subtitle:"",confidence:"confirmed",details:infra.map(s=>"Infrastructure: "+s)});
   addEvidence(d,{title:"Tracking IDs and platform fingerprints",source:hits[0].url,confidence:"correlation",note:infra.join(" · ")+". Shared IDs across stores are strong operator signals; shared vendors (checkout, subscriptions) are not."});
  }
  if(!ranked.length)d.questions.push(`No legal entity is named on ${ctx.domain}'s legal pages. Check trademark filings and the payment descriptor.`);
  else d.questions.push(`Pull the state registry record for ${ranked[0].label}: officers, registered agent, formation date.`);
  if(ranked[0])d.questions.push(`Search USPTO for trademarks owned by ${ranked[0].label} to find sibling brands.`);
  if(ids.size)d.questions.push(`Search other stores for the same tracking IDs (${[...ids].slice(0,3).join(", ")}).`);
  notes.push(`Found ${ranked.length} companies, ${emails.size} emails, ${phones.size} phones, ${addresses.size} addresses, ${ids.size} tracking IDs.`);
  const pick=(re:RegExp)=>[...ids].filter(x=>re.test(x)).map(x=>x.replace(/^(Meta pixel|Clarity|Klaviyo) /,""));
  const identifiers={shopifyStore:shop?shop+".myshopify.com":null,googleTagManager:pick(/^GTM-/),googleAnalytics:pick(/^(G|UA)-/),googleAds:pick(/^AW-/),metaPixel:pick(/^Meta pixel /),clarity:pick(/^Clarity /),klaviyo:pick(/^Klaviyo /),checkoutVendor:[...vendors][0]||null,supportEmails:[...emails.keys()].filter(brandDomain),phones:[...phones.values()].map(v=>v.split("|")[0]),relatedDomains:[...subdomains].map(x=>({domain:x,relation:"subdomain",confidence:"confirmed"}))};
  return {findings,draft:d,notes,identifiers};
 }
}

// ---------- domain registration (RDAP) ----------

class RdapProvider implements ResearchProvider{
 name="rdap";label="Domain registration (RDAP)";
 supports(ctx:ProviderContext){return isPublicHostname(ctx.domain)}
 async run(ctx:ProviderContext):Promise<ProviderResult>{
  const d=emptyDraft();const reg=ctx.domain.split(".").slice(-2).join(".");
  const url="https://rdap.org/domain/"+reg;
  try{
   const r=await safeFetch(url,{timeoutMs:9000,accept:"application/rdap+json,application/json"});
   if(r.status>=400)return {findings:[],draft:d,notes:[`RDAP lookup returned HTTP ${r.status}`]};
   const j=JSON.parse(r.body);
   const ev=(a:string)=>(j.events||[]).find((e:any)=>e.eventAction===a)?.eventDate?.slice(0,10);
   const registered=ev("registration"),expires=ev("expiration"),changed=ev("last changed");
   const registrar=(j.entities||[]).find((e:any)=>(e.roles||[]).includes("registrar"));
   const registrarName=registrar?.vcardArray?.[1]?.find((v:any)=>v[0]==="fn")?.[3]||registrar?.handle||"";
   const registrant=(j.entities||[]).find((e:any)=>(e.roles||[]).includes("registrant"));
   const registrantOrg=registrant?.vcardArray?.[1]?.find((v:any)=>v[0]==="org")?.[3]||registrant?.vcardArray?.[1]?.find((v:any)=>v[0]==="fn")?.[3]||"";
   if(registered)d.timeline.push({date:registered,title:`${reg} registered`,body:`Registrar: ${registrarName||"unknown"} (RDAP).`});
   const note=[registered&&`Registered ${registered}`,expires&&`expires ${expires}`,changed&&`last changed ${changed}`,registrarName&&`registrar ${registrarName}`].filter(Boolean).join(", ");
   addEvidence(d,{title:`RDAP record for ${reg}`,source:url,confidence:"confirmed",note:note||"RDAP record retrieved"});
   const target=ctx.seedType==="domain"?"seed":keyFor("domain",ctx.domain);
   addNode(d,{key:target,type:"domain",label:ctx.domain,subtitle:"",confidence:"confirmed",details:[note].filter(Boolean)});
   if(registrantOrg&&!/redacted|privacy|proxy|withheld|domains by proxy|contact privacy|not disclosed|data protected/i.test(registrantOrg)){
    const k=addNode(d,{type:"company",label:registrantOrg,subtitle:"Domain registrant (RDAP)",confidence:"strong",details:["Named as registrant organization in RDAP"]});
    addEdge(d,{from:k,to:target,label:"OWNS",confidence:"strong"});
   }
   return {findings:[{title:`RDAP ${reg}`,url,publisher:"rdap.org",snippet:note,sourceType:"registry",entities:[],claims:[]}],draft:d,notes:[note]};
  }catch(e){return {findings:[],draft:d,notes:["RDAP lookup failed: "+(e instanceof Error?e.message:"error")]}}
 }
}

// ---------- archive history (Wayback) ----------

class WaybackProvider implements ResearchProvider{
 name="wayback";label="Archive history (Wayback Machine)";
 supports(ctx:ProviderContext){return isPublicHostname(ctx.domain)}
 async run(ctx:ProviderContext):Promise<ProviderResult>{
  const d=emptyDraft();
  const url=`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(ctx.domain)}&output=json&limit=1&fl=timestamp,original`;
  try{
   const r=await safeFetch(url,{timeoutMs:20000,accept:"application/json"});
   const rows=JSON.parse(r.body||"[]");
   if(rows.length<2)return {findings:[],draft:d,notes:["No Wayback captures found"]};
   const ts=String(rows[1][0]);const date=`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
   const snap=`https://web.archive.org/web/${ts}/${ctx.domain}`;
   d.timeline.push({date,title:`First archived capture of ${ctx.domain}`,body:"Earliest Wayback Machine snapshot; the site existed by this date."});
   addEvidence(d,{title:`Earliest Wayback capture of ${ctx.domain}`,source:snap,confidence:"confirmed",note:`First captured ${date}. Earlier versions can reveal predecessor brands and entities.`});
   d.questions.push(`Compare the ${date} archived terms page with today's to catch entity changes or a rebrand.`);
   return {findings:[{title:"Wayback first capture",url:snap,publisher:"web.archive.org",snippet:date,sourceType:"infrastructure",entities:[],claims:[]}],draft:d,notes:[`First archived ${date}`]};
  }catch(e){return {findings:[],draft:d,notes:["Wayback lookup failed: "+(e instanceof Error?e.message:"error")]}}
 }
}

// ---------- certificate transparency (crt.sh) ----------

class CertProvider implements ResearchProvider{
 name="crtsh";label="Certificate logs (subdomains)";
 supports(ctx:ProviderContext){return isPublicHostname(ctx.domain)}
 async run(ctx:ProviderContext):Promise<ProviderResult>{
  const d=emptyDraft();const reg=ctx.domain.split(".").slice(-2).join(".");
  const url=`https://crt.sh/?q=${encodeURIComponent("%."+reg)}&output=json&exclude=expired`;
  try{
   const r=await safeFetch(url,{timeoutMs:12000,maxBytes:2_000_000,accept:"application/json"});
   const rows:any[]=JSON.parse(r.body||"[]");
   const names=new Set<string>();
   for(const row of rows)for(const n of String(row.name_value||"").split("\n")){const h=n.trim().toLowerCase().replace(/^\*\./,"");if(h.endsWith(reg)&&h!==reg&&!h.startsWith("www."))names.add(h)}
   const interesting=[...names].filter(h=>/^(checkout|get|pay|secure|shop|store|offer|offers|buy|try|go|lp|order|orders|funnel|join|start|special|deals?)\./.test(h)).slice(0,8);
   const target=ctx.seedType==="domain"?"seed":keyFor("domain",ctx.domain);
   for(const h of interesting){const k=addNode(d,{type:"domain",label:h,subtitle:"Funnel / checkout subdomain (certificate logs)",confidence:"confirmed",details:["Found in public TLS certificate logs"]});addEdge(d,{from:target,to:k,label:"SHARED INFRASTRUCTURE",confidence:"confirmed"})}
   if(names.size)addEvidence(d,{title:`Certificate transparency for ${reg}`,source:`https://crt.sh/?q=%25.${reg}`,confidence:"confirmed",note:`${names.size} subdomains seen: ${[...names].slice(0,12).join(", ")}`});
   return {findings:names.size?[{title:"crt.sh subdomains",url:`https://crt.sh/?q=%25.${reg}`,publisher:"crt.sh",snippet:[...names].slice(0,40).join(", "),sourceType:"infrastructure",entities:[],claims:[]}]:[],draft:d,notes:[`${names.size} subdomains in certificate logs`]};
  }catch(e){return {findings:[],draft:d,notes:["Certificate log lookup failed: "+(e instanceof Error?e.message:"error")]}}
 }
}

// ---------- portfolio (existing investigations) ----------

class PortfolioProvider implements ResearchProvider{
 name="portfolio";label="Your existing investigations";
 supports(){return true}
 async run(ctx:ProviderContext):Promise<ProviderResult>{
  return this.runTerms(ctx,[{term:ctx.seedValue,from:"seed"},...(ctx.domain&&ctx.domain!==ctx.seedValue?[{term:ctx.domain,from:"seed"}]:[])]);
 }
 // Each term is linked from the node it came from ("seed" or a discovered entity's key).
 async runTerms(ctx:ProviderContext,terms:{term:string;from:string}[]):Promise<ProviderResult>{
  const d=emptyDraft();const findings:ProviderFinding[]=[];
  const matches=(await Promise.all(terms.map(async t=>(await searchPortfolio(t.term,ctx.investigationId)).map(m=>({...m,from:t.from}))))).flat();
  const seenCases=new Set<string>();
  for(const m of matches.slice(0,25)){
   if(seenCases.has(m.investigation.id+m.entity.label))continue;seenCases.add(m.investigation.id+m.entity.label);
   if(!m.relations.length&&m.entity.id.endsWith(":seed"))continue; // an unresearched seed says nothing
   const brandKey=addNode(d,{type:"brand",label:m.investigation.name,subtitle:`Existing investigation · ${m.investigation.domain||m.investigation.id}`,confidence:m.entity.confidence==="excluded"?"excluded":"correlation",details:[`Matched entity: ${m.entity.label} (${m.entity.type})`,...m.relations.slice(0,4).map(r=>`${r.label} (${r.confidence}) in that case`)]});
   const rel=m.relations[0];
   addEdge(d,{from:m.from,to:brandKey,label:rel?rel.label:"CORRELATION",confidence:rel&&rel.confidence!=="confirmed"?rel.confidence:rel?"strong":"correlation"});
   addEvidence(d,{title:`Appears in investigation “${m.investigation.name}”`,source:`/investigations/${m.investigation.id}`,confidence:"correlation",note:`${m.entity.label} is recorded there as a ${m.entity.type} (${m.entity.confidence})${rel?`, linked by ${rel.label}`:""}. Review that case's evidence before treating this as ownership.`});
   findings.push({title:m.investigation.name,url:`/investigations/${m.investigation.id}`,publisher:"Operator Intelligence",snippet:`${m.entity.label} (${m.entity.type})`,sourceType:"portfolio",entities:[],claims:[]});
  }
  return {findings,draft:d,notes:[`${seenCases.size} matches in existing investigations`]};
 }
}

export const portfolio=new PortfolioProvider();
export const firstParty=new FirstPartyProvider();export const certs=new CertProvider();
export const providers:ResearchProvider[]=[portfolio,firstParty,new RdapProvider(),new WaybackProvider(),certs];
export {cleanDomain};
