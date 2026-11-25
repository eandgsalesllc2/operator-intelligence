// Traffic, revenue forecast and marketing data for a brand from BrandSearch (traffic, products, Meta/TikTok/
// Instagram/email activity) and Atria (live landing pages). Server-only: keys come from BRANDSEARCH_API_KEY
// and ATRIA_API_KEY. Everything is best-effort — a missing brand or a failed call leaves that part empty.
import {classifyPages,urlKind,PAGE_KIND_LABEL} from "./page-type";
import {forecast,type Metrics} from "./metrics";
import type {Marketing} from "./profile";

const BS="https://api.brandsearch.co/v1";
const ATRIA="https://api.tryatria.com/open/v1";
export const brandsearchEnabled=()=>Boolean(process.env.BRANDSEARCH_API_KEY);
export const atriaEnabled=()=>Boolean(process.env.ATRIA_API_KEY);

type Q=Record<string,string|number|boolean|undefined|(string|number)[]>;
function qs(q:Q){const u=new URLSearchParams();for(const [k,v] of Object.entries(q)){if(v===undefined||v==="")continue;if(Array.isArray(v))v.forEach(x=>u.append(k,String(x)));else u.set(k,String(v))}const s=u.toString();return s?"?"+s:""}
// Retries rate limits (429) and server errors with backoff; 404 means "no such brand" and returns null.
const errors:string[]=[];
export const trace:string[]=[]; // per-call log for /api/integrations diagnostics
async function get(base:string,key:string|undefined,path:string,q:Q={},body?:unknown){
 if(!key)throw new Error("not configured");
 for(let attempt=0;;attempt++){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),20000);
  try{
   const r=await fetch(base+path+qs(q),{method:body===undefined?"GET":"POST",headers:{"X-API-Key":key,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body),signal:ctl.signal,cache:"no-store"});
   trace.push(`${r.status} ${body===undefined?"":"POST "}${path}${qs(q)}`);
   if(r.status===404)return null;
   if((r.status===429||r.status>=500)&&attempt<3){const wait=Math.min(8000,(+(r.headers.get("retry-after")||0)*1000)||1500*2**attempt);await new Promise(res=>setTimeout(res,wait));continue}
   if(!r.ok){const msg=`${r.status} ${(await r.text()).slice(0,160)}`;errors.push(`${new URL(base).hostname}${path.split("?")[0]}: ${msg}`);throw new Error(msg)}
   const json=await r.json();
   // Atria answers some failures (bad params, removed endpoints) with HTTP 200 and a non-zero `code`. 40401 = not found.
   if(typeof json?.code==="number"&&json.code!==0){if(json.code===40401)return null;const msg=`code ${json.code}: ${String(json.message||"").slice(0,160)}`;errors.push(`${new URL(base).hostname}${path.split("?")[0]}: ${msg}`);throw new Error(msg)}
   const n=json?.data?.items?.length;if(n!=null)trace[trace.length-1]+=` → ${n} items`;return json;
  }catch(e){if(ctl.signal.aborted&&attempt<1)continue;throw e}
  finally{clearTimeout(t)}
 }
}
const bs=(path:string,q?:Q)=>get(BS,process.env.BRANDSEARCH_API_KEY,path,q);
const atria=(path:string,q?:Q)=>get(ATRIA,process.env.ATRIA_API_KEY,path,q);
const atriaPost=(path:string,body:unknown)=>get(ATRIA,process.env.ATRIA_API_KEY,path,{},body);
const settle=async<T,>(p:Promise<T>)=>{try{return await p}catch{return null}};
const num=(v:any)=>typeof v==="number"&&isFinite(v)?v:null;
const sortedKeys=(o:any)=>Object.entries(o||{}).filter(([,v])=>typeof v==="number"&&(v as number)>0).sort((a,b)=>(b[1] as number)-(a[1] as number)).map(([k])=>k);

const bare=(d:string)=>d.toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0];
const rootDomain=(d:string)=>bare(d).split(".").slice(-2).join(".");
// "tryauri.com" → "auri"; "shop.drsquatch.com" → "drsquatch"
const nameStem=(d:string)=>rootDomain(d).split(".")[0].replace(/^(try|get|shop|drink|use|my|the|buy|go|join)(?=[a-z]{3,})/,"");

export type SourceReport={source:"brandsearch"|"atria";ok:boolean;note:string};
export type MarketingPull={metrics?:Metrics;marketing?:Marketing;reports:SourceReport[]};

// ---------------- BrandSearch ----------------
async function resolveBrandsearchId(domain:string){
 for(const id of [...new Set([bare(domain),rootDomain(domain)])]){
  const b=await settle(bs(`/brands/${encodeURIComponent(id)}`,{fields:"id,name,monthly_visits,product_count"}));
  if(b&&(b.id||b.monthly_visits!=null))return {id:b.id||id,brand:b};
 }
 const l=await settle(bs("/lookup",{q:rootDomain(domain),type:"domain",limit:3}));
 const hit=(l?.data||l?.results||l?.brands||[]).find((x:any)=>x?.id&&rootDomain(String(x.id))===rootDomain(domain));
 if(hit){const b=await settle(bs(`/brands/${encodeURIComponent(hit.id)}`,{fields:"id,name,monthly_visits,product_count"}));if(b)return {id:hit.id,brand:b}}
 return null;
}

async function fromBrandsearch(domain:string):Promise<{metrics?:Metrics;marketing?:Marketing;note:string;topCopy:string[]}>{
 const r=await resolveBrandsearchId(domain);
 if(!r)return {note:`No BrandSearch brand for ${bare(domain)}`,topCopy:[]};
 const id=encodeURIComponent(r.id);
 const [best,latest,aggAll,aggActive,advertisers,tiktok,insta,emails,ads]=await Promise.all([
  settle(bs(`/brands/${id}/products`,{product_type:"bestsellers",fields:"title,price"})),
  settle(bs(`/brands/${id}/products`,{product_type:"latest",fields:"title,price"})),
  settle(bs(`/brands/${id}/ads/aggregates`)),
  settle(bs(`/brands/${id}/ads/aggregates`,{status:"active"})),
  settle(bs(`/brands/${id}/advertisers`,{limit:25})),
  settle(bs(`/brands/${id}/posts/aggregates`,{platform:"tiktok"})),
  settle(bs(`/brands/${id}/posts/aggregates`,{platform:"instagram"})),
  settle(bs(`/brands/${id}/emails`,{page_size:5,fields:"subject,timestamp,type"})),
  settle(bs(`/brands/${id}/ads`,{platform:"meta",status:"active",sort_by:"reach",page_size:12})),
 ]);
 // Revenue forecast from visits and bestseller prices (latest products when there's no bestseller ranking).
 const priced=(p:any)=>(p?.bestsellers||p?.latest||p?.products||p?.data||[]).map((x:any)=>({title:String(x.title||""),price:num(x.price?.amount??x.price),currency:x.price?.currencyCode})).filter((x:any)=>x.price!=null);
 let items=priced(best);const usedLatest=!items.length;if(usedLatest)items=priced(latest);
 const visits=num(r.brand.monthly_visits);
 const f=forecast(visits,items.map((x:any)=>x.price));
 const currency=items[0]?.currency||"USD";
 const active=num(aggActive?.window?.ad_count)??0,total=num(aggAll?.window?.ad_count)??0;
 const metrics:Metrics={monthlyVisits:visits,revenue:f.revenue,aov:f.aov,currency,productCount:num(r.brand.product_count),metaActiveAds:active,metaTotalAds:total,
  bestsellers:items.slice(0,5).map((x:any)=>({title:x.title,price:x.price})),source:"BrandSearch",sourceUrl:`https://app.brandsearch.co/brand-analysis/${r.id}`,asOf:new Date().toISOString().slice(0,10),
  method:usedLatest&&items.length?"Forecast, not reported revenue: visits × 1–3% conversion × AOV. BrandSearch has no bestseller ranking for this store, so AOV is the median of its most recently listed prices.":undefined};
 const stem=nameStem(domain);const brandish=(n:string)=>{const s=n.toLowerCase().replace(/[^a-z0-9]/g,"");return s.includes(stem)||stem.includes(s.slice(0,6))};
 const pages=(advertisers?.data||[]).map((p:any)=>({name:String(p.page_name||""),likes:num(p.page_likes),ads:num(p.ad_count)??0,activeAds:num(p.active_ad_count)??0,euSpend:num(p.total_eu_spend)??0,persona:!brandish(String(p.page_name||"")),created:p.page_created_at_unix?new Date(p.page_created_at_unix*1000).toISOString().slice(0,10):null})).filter((p:any)=>p.name);
 const adRows=(ads?.data||ads?.items||[]) as any[];
 const topAds=adRows.slice(0,6).map(a=>({hook:String(a.creative?.description||a.description||"").slice(0,240),headline:a.creative?.title||a.title||null,format:a.is_video?"video":a.is_image?"image":undefined,cta:a.creative?.cta?.type||null,funnel:a.funnel_type||null,euReach:num(a.eu_total_reach)})).filter(a=>a.hook||a.headline);
 const eng=(x:any,k:string,f:"sum"|"max")=>num(x?.engagement_summary?.[k]?.[f]);
 const emailTotal=num(emails?.pagination?.total);
 const emailRows=(emails?.data||[]) as any[];
 const marketing:Marketing={asOf:metrics.asOf,source:"BrandSearch",sourceUrl:metrics.sourceUrl,
  meta:total||active?{totalAds:total,activeAds:active,mediaMix:aggAll?.media_mix,activeMediaMix:aggActive?.media_mix,funnelMix:aggActive?.funnel_mix||aggAll?.funnel_mix,ctaMix:aggActive?.cta_breakdown||aggAll?.cta_breakdown,
   topCountries:sortedKeys(aggAll?.demography?.country).slice(0,12),euSpend:num(aggAll?.spend_summary?.eu_total_spend),euReach:num(aggAll?.spend_summary?.eu_total_reach),
   pages,personaPageCount:pages.filter((p:any)=>p.persona&&p.activeAds>0).length,topAds}:null,
  tiktok:num(tiktok?.window?.ad_count)?{posts:tiktok.window.ad_count,plays:eng(tiktok,"play_count","sum")??undefined,likes:eng(tiktok,"digg_count","sum")??undefined,shares:eng(tiktok,"share_count","sum")??undefined,maxPlays:eng(tiktok,"play_count","max")??undefined}:null,
  instagram:num(insta?.window?.ad_count)?{posts:insta.window.ad_count,likes:(eng(insta,"like_count","sum")??eng(insta,"digg_count","sum"))??undefined,comments:eng(insta,"comment_count","sum")??undefined,maxLikes:(eng(insta,"like_count","max")??eng(insta,"digg_count","max"))??undefined}:null,
  email:emailTotal?{total:emailTotal,lastSent:emailRows[0]?.timestamp||null,recentSubjects:emailRows.map(e=>String(e.subject||"")).filter(Boolean)}:null,
 };
 const note=`${visits!=null?visits.toLocaleString("en-US")+" visits/mo":"no traffic"}, ${active} active of ${total} Meta ads, ${pages.length} ad pages`;
 return {metrics,marketing,note,topCopy:topAds.map(a=>[a.headline,a.hook].filter(Boolean).join(" — "))};
}

// ---------------- Atria: running landing pages ----------------
// Page types (PDP, listicle, advertorial, quiz…) come from lib/page-type.ts.
function unwrap(u:string){try{const x=new URL(u);if(/(^|\.)facebook\.com$/.test(x.hostname)&&x.pathname==="/l.php"){const inner=x.searchParams.get("u");if(inner)return inner}return u}catch{return u}}

// Atria's API (v0.2.0, Oct 2026): brands come from POST /inspo-brands/search, which matches on the brand's own
// hosts, and their ads from GET /ad-library/search scoped to that brand (every advertiser that runs its ads).
const isUuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const adScope=(id:string)=>isUuid(id)?{unified_brand_id:[id]}:{brand_id:[id]};
async function atriaAds(scope:Q,status:"active"|"inactive",pagesN:number,pageSize=50){
 const out:any[]=[];let cursor:string|undefined;let total=0;
 for(let i=0;i<pagesN;i++){
  const r=await atria("/ad-library/search",{...scope,status:[status],order:status==="active"?"most_impressions":"recently_ended",page_size:pageSize,cursor});
  const d=r?.data;if(!d)break;if(i===0)total=d.total||0;out.push(...(d.items||[]));cursor=d.cursor||undefined;if(!cursor)break;
 }
 return {ads:out,total};
}

async function fromAtria(domain:string,brandName:string){
 const root=rootDomain(domain);const stem=nameStem(domain);
 const onRoot=(h:string)=>{const x=bare(h||"");return x===root||x.endsWith("."+root)};
 const ownsRoot=(b:any)=>[b.primary_host,...(b.hosts||[])].some((h:string)=>h&&onRoot(h));
 // By host first (exact), then by name — but a name match still has to own this domain.
 const cands=new Map<string,any>();
 const search=async(library:Record<string,unknown>)=>{const r=await atriaPost("/inspo-brands/search",{scope:"library",library:{...library,limit:20}});for(const b of r?.data?.items||[])if(ownsRoot(b))cands.set(b.id,b)};
 await search({host:root});
 if(!cands.size){const words=[brandName.replace(/\.[a-z]{2,}$/i,"").trim(),stem].filter((w,i,a)=>w.length>=3&&!/\.|^www/i.test(w)&&a.indexOf(w)===i);for(const w of words){await search({brand_name:w});if(cands.size)break}}
 if(!cands.size)return {note:`No Atria brand owns ${root}`};
 const brand=[...cands.values()].sort((x,y)=>Number(onRoot(y.primary_host||""))-Number(onRoot(x.primary_host||""))||(y.ads?.active||0)-(x.ads?.active||0))[0];
 const advs:any[]=brand.advertisers||[];
 const mainAdv=advs.find(a=>a.main)||advs.find(a=>a.official)||advs[0];
 // Ads for the whole brand; if the brand scope comes back empty, fall back to its main advertiser.
 let scope:Q=adScope(brand.id);
 let {ads:mainAds,total}=await atriaAds(scope,"active",2);let status:"active"|"inactive"="active";
 if(!mainAds.length&&mainAdv?.id){scope=adScope(String(mainAdv.id));({ads:mainAds,total}=await atriaAds(scope,"active",2))}
 if(!mainAds.length){status="inactive";mainAds=(await atriaAds(scope,"inactive",1)).ads}
 const otherAds:any[]=[];
 const main={id:String(mainAdv?.id||brand.id),name:mainAdv?.name||brand.name||root,ad_num:mainAdv?.total_ads??brand.ads?.total};
 const verified=[main,...advs.filter(a=>a!==mainAdv&&(a.official||(a.total_ads||0)>=20)).slice(0,6).map(a=>({id:String(a.id),name:a.name||"?",ad_num:a.total_ads}))];
 const groups=new Map<string,any>();
 for(const a of [...mainAds,...otherAds]){
  if(!a.link_url)continue;
  let url:URL;try{url=new URL(unwrap(a.link_url))}catch{continue}
  const host=bare(url.hostname);const path=url.pathname.replace(/\/+$/,"")||"/";const key=host+path;
  const g=groups.get(key)||{url:`https://${host}${path==="/"?"":path}`,host,path,kind:urlKind(host,path,host.endsWith(root),String(a.title||"")),activeAds:0,bestRank:null as number|null,maxDaysRunning:0,pages:new Set<string>(),headline:a.title||null,status};
  g.activeAds++;const rk=num(a.impression_rank?.peak_rank?.rank)??num(a.impression_rank?.latest_rank?.rank)??num(a.impression_rank?.best?.rank);if(rk!=null&&(g.bestRank==null||rk<g.bestRank))g.bestRank=rk;
  g.maxDaysRunning=Math.max(g.maxDaysRunning,num(a.days_running)??0);if(a.brand_name)g.pages.add(String(a.brand_name));groups.set(key,g);
 }
 const ranked2=[...groups.values()].sort((a,b)=>b.activeAds-a.activeAds||(a.bestRank??1e9)-(b.bestRank??1e9));
 await classifyPages(ranked2,root); // open the top pages: the URL alone can't tell a listicle from a sales page
 const landingPages=ranked2.slice(0,25).map(g=>({...g,pages:[...g.pages]}));
 const hosts=new Map<string,number>();const kindMix:Record<string,number>={};
 for(const g of groups.values()){hosts.set(g.host,(hosts.get(g.host)||0)+g.activeAds);kindMix[g.kind]=(kindMix[g.kind]||0)+g.activeAds}
 const top=Object.entries(kindMix).sort((a,b)=>b[1]-a[1]);
 const landing:NonNullable<Marketing["landing"]>={asOf:new Date().toISOString().slice(0,10),source:"Atria ad library (landing URLs)",brandId:String(brand.id),
  advertisers:verified.map((b,i)=>({id:b.id,name:b.name,totalAds:b.ad_num,role:i===0?"main":"linking_page"})),
  landingPages,hosts:[...hosts.entries()].sort((a,b)=>b[1]-a[1]).map(([host,activeAds])=>({host,activeAds})),kindMix,
  sampledActiveAds:mainAds.length+otherAds.length,totalActiveAds:status==="active"?(total||brand.ads?.active||0):0,
  notes:landingPages.length?`${status==="inactive"?"No active ads; showing the most recently ended. ":""}Most ads go to ${top.slice(0,2).map(([k,v])=>`${PAGE_KIND_LABEL[k]||k} pages (${v})`).join(" and ")} across ${hosts.size} host${hosts.size>1?"s":""}.`:"The matched advertiser has no ads with landing URLs."};
 return {landing,note:`${landingPages.length} landing pages from ${main.name}`};
}

// Pulls both sources in parallel. brandName helps Atria find the advertiser (it searches by name).
export async function pullMarketing(domain:string,brandName:string):Promise<MarketingPull>{
 const reports:SourceReport[]=[];errors.length=0;trace.length=0;
 if(!domain)return {reports};
 const [b,a]=await Promise.all([
  brandsearchEnabled()?fromBrandsearch(domain).catch(e=>({note:"failed: "+(e instanceof Error?e.message:"error"),topCopy:[] as string[]})):Promise.resolve(null),
  atriaEnabled()?fromAtria(domain,brandName).catch(e=>({note:"failed: "+(e instanceof Error?e.message:"error")})):Promise.resolve(null),
 ]);
 if(b)reports.push({source:"brandsearch",ok:"metrics" in b&&!!b.metrics,note:b.note});
 if(a)reports.push({source:"atria",ok:"landing" in a&&!!a.landing,note:a.note});
 const errs=[...new Set(errors)];if(errs.length)reports.push({source:errs.some(e=>e.includes("tryatria"))?"atria":"brandsearch",ok:false,note:"API errors: "+errs.slice(0,3).join(" | ")});
 const marketing:Marketing|undefined=b&&"marketing" in b&&b.marketing?{...b.marketing,...(a&&"landing" in a?{landing:a.landing}:{})}:a&&"landing" in a?{asOf:a.landing!.asOf,source:"Atria",landing:a.landing}:undefined;
 return {metrics:b&&"metrics" in b?b.metrics:undefined,marketing,reports,...({topCopy:b?.topCopy||[]} as any)};
}

// ---------------- Live ad creatives for the ad wall (fetched on demand; media URLs expire, so they're not stored) ----------------
export type Creative={id:string;image:string|null;video:string|null;format:string;title:string|null;body:string;cta:string|null;page:string|null;days:number|null;started:string|null;landing:string|null;source:"atria"|"brandsearch"};
export async function fetchCreatives(domain:string,atriaBrandId?:string|null,limit=24):Promise<{creatives:Creative[];source:string;note?:string}>{
 const clip=(s:any,n:number)=>String(s||"").replace(/\s+/g," ").trim().slice(0,n);
 if(atriaBrandId&&atriaEnabled()){
  const items=(await atriaAds(adScope(atriaBrandId),"active",1,Math.min(50,limit)).catch(()=>({ads:[] as any[]}))).ads;
  if(items.length)return {source:"Atria ad library",creatives:items.map(a=>({id:String(a.id),image:a.images?.[0]?.url||a.videos?.[0]?.preview_image_url||null,video:a.videos?.[0]?.url||null,format:a.videos?.length?"video":a.display_format||"image",title:a.title?clip(a.title,120):null,body:clip(a.body||a.caption,280),cta:a.cta_text||null,page:a.brand_name||null,days:num(a.days_running),started:a.start_date||null,landing:a.link_url?unwrap(a.link_url):null,source:"atria" as const}))};
 }
 if(brandsearchEnabled()&&domain){
  const r=await resolveBrandsearchId(domain);
  if(r){const d=await settle(bs(`/brands/${encodeURIComponent(r.id)}/ads`,{platform:"meta",status:"active",sort_by:"reach",page_size:Math.min(50,limit)}));
   const items=(d?.data||[]) as any[];
   if(items.length)return {source:"BrandSearch",creatives:items.map(a=>({id:String(a.id),image:a.image_url||a.thumbnail_url||null,video:a.video_hd_url||a.video_sd_url||null,format:a.is_video?"video":"image",title:a.creative?.title?clip(a.creative.title,120):null,body:clip(a.creative?.description,280),cta:a.creative?.cta?.text||null,page:a.page_name||null,days:a.start_date?Math.max(0,Math.round((Date.now()-new Date(a.start_date).getTime())/864e5)):null,started:a.start_date||null,landing:null,source:"brandsearch" as const}))};
  }
 }
 return {creatives:[],source:"",note:"No active ad creatives found in Atria or BrandSearch for this brand."};
}
