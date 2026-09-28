// Watchlists: each user stars brands; watched brands are re-checked weekly (BrandSearch + Atria only, no AI web research)
// and every difference from the previous snapshot is recorded as a change the user sees in the app (and by email when
// an email service is configured).
import {getInvestigation,matchIdentifiers,refreshMarketing} from "./repository";
import {pullMarketing} from "./marketing-sources";
import {subscriptionFor} from "./metrics";
import {detectSellingPlans} from "./selling-plans";
import {identifierRows,STRONG_KINDS,KIND_LABEL,type Marketing} from "./profile";
import type {Metrics} from "./metrics";

async function db(path:string,init?:RequestInit){
 const url=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!k)throw new Error("Database is not configured");
 const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});
 if(!r.ok)throw new Error(await r.text());
 const text=await r.text(); // "return=minimal" writes come back with an empty body
 return text?JSON.parse(text):null;
}
const inList=(ids:string[])=>`(${ids.map(x=>`"${x.replace(/"/g,"")}"`).join(",")})`;

export type Snapshot={subscription?:boolean;visits:number|null;activeAds:number|null;totalAds:number|null;landing:{key:string;kind:string;ads:number}[];persona:{name:string;active:number}[];linked:{id:string;name:string;kinds:string[]}[]};
export type Change={kind:string;severity:"info"|"notable"|"major";title:string;detail?:string};

function snapshotOf(metrics:Metrics|undefined|null,m:Marketing|undefined|null,linked:Snapshot["linked"]):Snapshot{
 return {subscription:!!metrics?.subscription?.focused,visits:metrics?.monthlyVisits??null,activeAds:m?.meta?.activeAds??metrics?.metaActiveAds??null,totalAds:m?.meta?.totalAds??metrics?.metaTotalAds??null,
  landing:(m?.landing?.landingPages||[]).filter(l=>l.status!=="inactive").map(l=>({key:`${l.host||""}${l.path||""}`,kind:l.kind||"",ads:l.activeAds||0})),
  persona:(m?.meta?.pages||[]).filter(p=>p.persona).map(p=>({name:p.name,active:p.activeAds||0})),linked};
}
const KIND:Record<string,string>={advertorial:"advertorial / presell",offer_lp:"offer",product:"product",collection:"collection",home:"homepage",quiz:"quiz",checkout:"checkout",marketplace:"marketplace",external:"off-site"};
const pct=(a:number,b:number)=>b?Math.round((a-b)/b*100):0;

export function diff(prev:Snapshot,next:Snapshot):Change[]{
 const out:Change[]=[];
 const pl=new Map(prev.landing.map(l=>[l.key,l]));const nl=new Map(next.landing.map(l=>[l.key,l]));
 for(const l of next.landing)if(!pl.has(l.key)&&l.ads>=2)out.push({kind:"landing_new",severity:["advertorial","quiz","external"].includes(l.kind)?"major":"notable",title:`New ${KIND[l.kind]||l.kind} page in rotation`,detail:`${l.key} · ${l.ads} active ads`});
 for(const l of prev.landing)if(!nl.has(l.key)&&l.ads>=3)out.push({kind:"landing_gone",severity:"info",title:"Stopped sending ads to a page",detail:`${l.key} (had ${l.ads} ads)`});
 const pp=new Map(prev.persona.map(p=>[p.name.toLowerCase(),p]));
 for(const p of next.persona){const b=pp.get(p.name.toLowerCase());
  if(p.active>0&&(!b||b.active===0))out.push({kind:"persona_new",severity:"notable",title:`Persona page started running ads: ${p.name}`,detail:`${p.active} active ads`});
  else if(b&&b.active>0&&p.active>=Math.max(b.active*2,b.active+15))out.push({kind:"persona_surge",severity:"notable",title:`Persona page ramped up: ${p.name}`,detail:`${b.active} → ${p.active} active ads`});}
 if(prev.activeAds!=null&&next.activeAds!=null){const d=next.activeAds-prev.activeAds,p=pct(next.activeAds,prev.activeAds);
  if(Math.abs(d)>=20&&Math.abs(p)>=30)out.push({kind:"ads_change",severity:Math.abs(p)>=100?"major":"notable",title:`Active Meta ads ${d>0?"up":"down"} ${Math.abs(p)}%`,detail:`${prev.activeAds.toLocaleString()} → ${next.activeAds.toLocaleString()}`});}
 if(prev.visits&&next.visits&&prev.visits>=5000){const p=pct(next.visits,prev.visits);
  if(Math.abs(p)>=25)out.push({kind:"traffic_change",severity:Math.abs(p)>=60?"major":"notable",title:`Monthly visits ${p>0?"up":"down"} ${Math.abs(p)}%`,detail:`${prev.visits.toLocaleString()} → ${next.visits.toLocaleString()}`});}
 if(prev.subscription===false&&next.subscription)out.push({kind:"subscription_on",severity:"notable",title:"Started selling on subscription",detail:"Selling plans now on the store"});
 if(prev.subscription&&next.subscription===false)out.push({kind:"subscription_off",severity:"notable",title:"Subscription plans no longer found on the store"});
 const pk=new Set(prev.linked.map(x=>x.id));
 for(const x of next.linked)if(!pk.has(x.id))out.push({kind:"link_new",severity:"major",title:`Now linked to ${x.name}`,detail:`Shares ${x.kinds.join(", ")} — a lead, not proof of ownership`});
 return out;
}

async function linkedCases(c:{id:string;profile?:any;marketing?:any;domain?:string}):Promise<Snapshot["linked"]>{
 const ms=(await matchIdentifiers(identifierRows(c.profile,c.marketing,c.domain).map(r=>r.normalized),c.id)).filter(m=>STRONG_KINDS.has(m.kind)&&m.kind!=="attorney");
 const by=new Map<string,{id:string;name:string;kinds:Set<string>}>();
 for(const m of ms){const e=by.get(m.investigation_id)||{id:m.investigation_id,name:m.name,kinds:new Set<string>()};e.kinds.add((KIND_LABEL[m.kind]||m.kind).toLowerCase());by.set(m.investigation_id,e)}
 return [...by.values()].map(e=>({id:e.id,name:e.name,kinds:[...e.kinds]}));
}

export async function lastSnapshot(id:string):Promise<{taken_at:string;data:Snapshot}|null>{return (await db(`oi_watch_snapshots?investigation_id=eq.${encodeURIComponent(id)}&select=taken_at,data&order=taken_at.desc&limit=1`))?.[0]||null}

// Re-check one brand: fresh BrandSearch/Atria data, compare, record changes, refresh the stored marketing data.
export async function checkInvestigation(id:string):Promise<{changes:Change[];checked:boolean;note?:string}>{
 const c=await getInvestigation(id);if(!c)return {changes:[],checked:false,note:"Investigation not found"};
 const prevSnap=await lastSnapshot(id);
 const prev=prevSnap?.data||snapshotOf(c.metrics,c.marketing,await linkedCases(c).catch(()=>[]));
 let metrics=c.metrics,marketing=c.marketing,profile=c.profile;
 if(c.domain){
  const plans=await detectSellingPlans(c.domain).catch(()=>null);
  if(plans)profile={...(c.profile||{}),identifiers:{...(c.profile?.identifiers||{}),sellingPlans:plans}};
  const mp=await pullMarketing(c.domain,/\.[a-z]{2,}$/i.test(c.name)?"":c.name).catch(()=>null);
  if(mp?.marketing)marketing={...(c.marketing||{}),...mp.marketing,strategy:c.marketing?.strategy??mp.marketing.strategy};
  if(mp?.metrics&&mp.metrics.monthlyVisits!=null)metrics={...mp.metrics,subscription:subscriptionFor(mp.metrics,profile?.identifiers?.subscriptionApp,marketing?.strategy?.offers,profile?.identifiers?.sellingPlans,profile?.identifiers?.subscriptionOverride)};
 }
 if(metrics&&metrics===c.metrics&&profile!==c.profile)metrics={...metrics,subscription:subscriptionFor(metrics,profile?.identifiers?.subscriptionApp,marketing?.strategy?.offers,profile?.identifiers?.sellingPlans,profile?.identifiers?.subscriptionOverride)};
 const next=snapshotOf(metrics,marketing,await linkedCases({...c,marketing}).catch(()=>prev.linked));
 const changes=diff(prev,next);
 if(changes.length)await db("oi_watch_changes",{method:"POST",body:JSON.stringify(changes.map(x=>({investigation_id:id,...x})))});
 await db("oi_watch_snapshots",{method:"POST",body:JSON.stringify({investigation_id:id,data:next})});
 if(metrics!==c.metrics||marketing!==c.marketing||profile!==c.profile)await refreshMarketing({...c,metrics,marketing,profile});
 return {changes,checked:true};
}

// ---- per-user watchlist ----
export async function watchedIds(userId:string):Promise<{investigation_id:string;created_at:string}[]>{return await db(`oi_watchlist?user_id=eq.${encodeURIComponent(userId)}&select=investigation_id,created_at&order=created_at.desc`)}
export async function setWatched(userId:string,investigationId:string,on:boolean){
 if(on)await db("oi_watchlist?on_conflict=user_id,investigation_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:userId,investigation_id:investigationId})});
 else await db(`oi_watchlist?user_id=eq.${encodeURIComponent(userId)}&investigation_id=eq.${encodeURIComponent(investigationId)}`,{method:"DELETE"});
}
export async function changesFor(ids:string[],limit=200){
 if(!ids.length)return [];
 return await db(`oi_watch_changes?investigation_id=in.${encodeURIComponent(inList(ids))}&select=id,investigation_id,detected_at,kind,severity,title,detail&order=detected_at.desc&limit=${limit}`);
}
export async function lastChecked(ids:string[]):Promise<Record<string,string>>{
 if(!ids.length)return {};
 const rows=await db(`oi_watch_snapshots?investigation_id=in.${encodeURIComponent(inList(ids))}&select=investigation_id,taken_at&order=taken_at.desc&limit=${ids.length*4}`);
 const out:Record<string,string>={};for(const r of rows)if(!out[r.investigation_id])out[r.investigation_id]=r.taken_at;return out;
}
export async function markSeen(userId:string){await db(`oi_users?id=eq.${encodeURIComponent(userId)}`,{method:"PATCH",body:JSON.stringify({watch_seen_at:new Date().toISOString()})})}

// ---- weekly job: re-check the watched brands that are due (oldest first), a few per run ----
export async function runDueChecks(budgetMs=240_000,max=10){
 const started=Date.now();
 const all:{investigation_id:string;user_id:string}[]=await db("oi_watchlist?select=investigation_id,user_id");
 const ids=[...new Set(all.map(r=>r.investigation_id))];
 const checked=await lastChecked(ids);const weekAgo=Date.now()-6.5*864e5;
 const due=ids.filter(id=>!checked[id]||new Date(checked[id]).getTime()<weekAgo).sort((a,b)=>(checked[a]||"").localeCompare(checked[b]||"")).slice(0,max);
 const results:Record<string,Change[]>={};
 for(let i=0;i<due.length;i+=3){
  if(Date.now()-started>budgetMs)break;
  await Promise.all(due.slice(i,i+3).map(async id=>{try{results[id]=(await checkInvestigation(id)).changes}catch{results[id]=[]}}));
 }
 await emailDigests(all,results).catch(()=>{});
 return {due:due.length,checked:Object.keys(results).length,changes:Object.values(results).reduce((s,x)=>s+x.length,0)};
}

async function emailDigests(all:{investigation_id:string;user_id:string}[],results:Record<string,Change[]>){
 const key=process.env.RESEND_API_KEY,from=process.env.RESET_FROM_EMAIL;if(!key||!from)return;
 const withChanges=Object.entries(results).filter(([,c])=>c.length);if(!withChanges.length)return;
 const names=new Map<string,string>((await db(`investigations?id=in.${encodeURIComponent(inList(withChanges.map(([id])=>id)))}&select=id,name`)).map((r:any)=>[r.id,r.name]));
 const byUser=new Map<string,string[]>();for(const r of all)if(results[r.investigation_id]?.length)byUser.set(r.user_id,[...(byUser.get(r.user_id)||[]),r.investigation_id]);
 const users=new Map<string,any>((await db(`oi_users?id=in.${encodeURIComponent(inList([...byUser.keys()]))}&select=id,email,full_name,status`)).map((u:any)=>[u.id,u]));
 for(const [uid,ids] of byUser){const u=users.get(uid);if(!u||u.status!=="approved")continue;
  const text=ids.map(id=>`${names.get(id)||id}\n`+results[id].map(c=>`  • ${c.title}${c.detail?` — ${c.detail}`:""}`).join("\n")).join("\n\n");
  await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:u.email,subject:`BrandTracer watchlist: ${ids.length} brand${ids.length>1?"s":""} changed`,text:`Hi ${String(u.full_name||"").split(" ")[0]||"there"},\n\nThis week's changes on your watchlist:\n\n${text}\n\nOpen BrandTracer to see the details.`})}).catch(()=>{});
 }
}
