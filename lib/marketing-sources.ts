// Traffic, revenue forecast and marketing data for a brand from BrandSearch (traffic, products, Meta/TikTok/
// Instagram/email activity) and Atria (live landing pages). Server-only: keys come from BRANDSEARCH_API_KEY
// and ATRIA_API_KEY. Everything is best-effort — a missing brand or a failed call leaves that part empty.
import {forecast,type Metrics} from "./metrics";
import type {Marketing} from "./profile";

const BS="https://api.brandsearch.co/v1";
const ATRIA="https://api.tryatria.com/open/v1";
export const brandsearchEnabled=()=>Boolean(process.env.BRANDSEARCH_API_KEY);
export const atriaEnabled=()=>Boolean(process.env.ATRIA_API_KEY);

type Q=Record<string,string|number|boolean|undefined|(string|number)[]>;
function qs(q:Q){const u=new URLSearchParams();for(const [k,v] of Object.entries(q)){if(v===undefined||v==="")continue;if(Array.isArray(v))v.forEach(x=>u.append(k,String(x)));else u.set(k,String(v))}const s=u.toString();return s?"?"+s:""}
async function get(base:string,key:string|undefined,path:string,q:Q={}){
 if(!key)throw new Error("not configured");
 const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),20000);
 try{
  const r=await fetch(base+path+qs(q),{headers:{"X-API-Key":key,Accept:"application/json"},signal:ctl.signal,cache:"no-store"});
  if(r.status===404)return null;
  if(!r.ok)throw new Error(`${r.status} ${(await r.text()).slice(0,160)}`);
  return await r.json();
 }finally{clearTimeout(t)}
}
const bs=(path:string,q?:Q)=>get(BS,process.env.BRANDSEARCH_API_KEY,path,q);
const atria=(path:string,q?:Q)=>get(ATRIA,process.env.ATRIA_API_KEY,path,q);
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
const MARKET=/(^|\.)(amazon\.|amzn\.|walmart\.|target\.com|costco\.|samsclub\.|sephora\.|ulta\.|cvs\.|walgreens\.|tiktok\.com)/;
function unwrap(u:string){try{const x=new URL(u);if(/(^|\.)facebook\.com$/.test(x.hostname)&&x.pathname==="/l.php"){const inner=x.searchParams.get("u");if(inner)return inner}return u}catch{return u}}
function classify(host:string,path:string,own:boolean,headline:string){
 const p=path.toLowerCase();
 if(MARKET.test(host))return "marketplace";
 if(/quiz|survey|assessment/.test(host+p))return "quiz";
 if(/checkout|\/cart/.test(p))return "checkout";
 if(/advertorial|article|story|blog|news|review|listicle|reasons|discover|doctor|\/why/.test(p)||/reasons|why .* (love|switch)/i.test(headline))return "advertorial";
 if(!own)return "external";
 if(p.startsWith("/products/"))return "product";
 if(p.startsWith("/collections/"))return "collection";
 if(p===""||p==="/")return "home";
 return "offer_lp";
}

async function fromAtria(domain:string,brandName:string){
 const root=rootDomain(domain);const stem=nameStem(domain);
 const words=[brandName.replace(/\.[a-z]{2,}$/i,"").trim(),stem].filter((w,i,a)=>w.length>=3&&!/\.|^www/i.test(w)&&a.indexOf(w)===i);
 const cands=new Map<string,any>();
 for(const w of words){const r=await settle(atria("/brand-library/search",{keyword:w,platform:["meta_ad_library"],page_size:10}));for(const b of r?.data?.items||[])cands.set(b.id,b)}
 const hostOf=(u:string)=>{try{return bare(new URL(unwrap(u)).hostname)}catch{return ""}};
 const linksHere=(ads:any[])=>ads.some(a=>hostOf(a.link_url||"").endsWith(root));
 // Keep only brands whose site is this domain, or whose ads link to it (name matches alone are not enough).
 const verified:any[]=[];
 const ranked=[...cands.values()].sort((a,b)=>(b.ad_num||0)-(a.ad_num||0)).slice(0,6);
 await Promise.all(ranked.map(async b=>{
  if(b.website_url&&hostOf(b.website_url).endsWith(root)){verified.push(b);return}
  const r=await settle(atria(`/brand-library/${encodeURIComponent(b.id)}/ads`,{status:["active"],order:"most_impressions",page_size:10}));
  if(linksHere(r?.data?.items||[]))verified.push(b);
 }));
 if(!verified.length)return {note:`No Atria advertiser links to ${root}`};
 verified.sort((a,b)=>(b.ad_num||0)-(a.ad_num||0));
 const main=verified.find(b=>b.name.toLowerCase().replace(/[^a-z0-9]/g,"").includes(stem))||verified[0];
 const pull=async(b:any,status:"active"|"inactive",pagesN:number)=>{const out:any[]=[];let cursor:string|undefined;let total=0;
  for(let i=0;i<pagesN;i++){const r=await settle(atria(`/brand-library/${encodeURIComponent(b.id)}/ads`,{status:[status],order:status==="active"?"most_impressions":"recently_ended",page_size:50,cursor}));const d=r?.data;if(!d)break;if(i===0)total=d.total||0;out.push(...(d.items||[]));cursor=d.cursor||undefined;if(!cursor)break}
  return {ads:out,total}};
 let {ads:mainAds,total}=await pull(main,"active",2);let status:"active"|"inactive"="active";
 if(!mainAds.length){status="inactive";mainAds=(await pull(main,"inactive",1)).ads}
 const others=verified.filter(b=>b!==main&&(b.ad_num||0)>=20).slice(0,2);
 const otherAds=(await Promise.all(others.map(b=>pull(b,"active",1)))).flatMap(x=>x.ads).filter(a=>hostOf(a.link_url||"").endsWith(root));
 const groups=new Map<string,any>();
 for(const a of [...mainAds,...otherAds]){
  if(!a.link_url)continue;
  let url:URL;try{url=new URL(unwrap(a.link_url))}catch{continue}
  const host=bare(url.hostname);const path=url.pathname.replace(/\/+$/,"")||"/";const key=host+path;
  const g=groups.get(key)||{url:`https://${host}${path==="/"?"":path}`,host,path,kind:classify(host,path,host.endsWith(root),String(a.title||"")),activeAds:0,bestRank:null as number|null,maxDaysRunning:0,pages:new Set<string>(),headline:a.title||null,status};
  g.activeAds++;const rk=num(a.impression_rank?.best?.rank)??num(a.impression_rank?.current?.rank)??num(a.impression_rank?.rank);if(rk!=null&&(g.bestRank==null||rk<g.bestRank))g.bestRank=rk;
  g.maxDaysRunning=Math.max(g.maxDaysRunning,num(a.days_running)??0);if(a.brand_name)g.pages.add(String(a.brand_name));groups.set(key,g);
 }
 const landingPages=[...groups.values()].sort((a,b)=>b.activeAds-a.activeAds||(a.bestRank??1e9)-(b.bestRank??1e9)).slice(0,25).map(g=>({...g,pages:[...g.pages]}));
 const hosts=new Map<string,number>();const kindMix:Record<string,number>={};
 for(const g of groups.values()){hosts.set(g.host,(hosts.get(g.host)||0)+g.activeAds);kindMix[g.kind]=(kindMix[g.kind]||0)+g.activeAds}
 const top=Object.entries(kindMix).sort((a,b)=>b[1]-a[1]);
 const landing:NonNullable<Marketing["landing"]>={asOf:new Date().toISOString().slice(0,10),source:"Atria ad library (landing URLs)",
  advertisers:[main,...verified.filter(b=>b!==main)].map((b,i)=>({id:b.id,name:b.name,totalAds:b.ad_num,role:i===0?"main":"linking_page"})),
  landingPages,hosts:[...hosts.entries()].sort((a,b)=>b[1]-a[1]).map(([host,activeAds])=>({host,activeAds})),kindMix,
  sampledActiveAds:mainAds.length+otherAds.length,totalActiveAds:status==="active"?total:0,
  notes:landingPages.length?`${status==="inactive"?"No active ads; showing the most recently ended. ":""}Most ads go to ${top.slice(0,2).map(([k,v])=>`${k.replace("_"," ")} pages (${v})`).join(" and ")} across ${hosts.size} host${hosts.size>1?"s":""}.`:"The matched advertiser has no ads with landing URLs."};
 return {landing,note:`${landingPages.length} landing pages from ${main.name}`};
}

// Pulls both sources in parallel. brandName helps Atria find the advertiser (it searches by name).
export async function pullMarketing(domain:string,brandName:string):Promise<MarketingPull>{
 const reports:SourceReport[]=[];
 if(!domain)return {reports};
 const [b,a]=await Promise.all([
  brandsearchEnabled()?fromBrandsearch(domain).catch(e=>({note:"failed: "+(e instanceof Error?e.message:"error"),topCopy:[] as string[]})):Promise.resolve(null),
  atriaEnabled()?fromAtria(domain,brandName).catch(e=>({note:"failed: "+(e instanceof Error?e.message:"error")})):Promise.resolve(null),
 ]);
 if(b)reports.push({source:"brandsearch",ok:"metrics" in b&&!!b.metrics,note:b.note});
 if(a)reports.push({source:"atria",ok:"landing" in a&&!!a.landing,note:a.note});
 const marketing:Marketing|undefined=b&&"marketing" in b&&b.marketing?{...b.marketing,...(a&&"landing" in a?{landing:a.landing}:{})}:a&&"landing" in a?{asOf:a.landing!.asOf,source:"Atria",landing:a.landing}:undefined;
 return {metrics:b&&"metrics" in b?b.metrics:undefined,marketing,reports,...({topCopy:b?.topCopy||[]} as any)};
}
