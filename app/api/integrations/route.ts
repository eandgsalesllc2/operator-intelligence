import {NextRequest} from "next/server";
import {atriaEnabled,brandsearchEnabled,pullMarketing,trace} from "@/lib/marketing-sources";

export const dynamic="force-dynamic";
export const maxDuration=120;

// GET → which data sources are configured. GET ?domain=x&name=y → run both pulls for that brand and summarise
// what came back (sign-in required via middleware; never returns key values).
export async function GET(req:NextRequest){
 const domain=req.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
 const status={brandsearch:brandsearchEnabled(),atria:atriaEnabled()};
 if(!domain)return Response.json(status);
 // ?probe=atria[&keyword=x] → raw Atria brand search by host (or name). ?probe=atria-ads&id=<brand id> → raw ad list.
 const atriaRaw=async(path:string,init?:RequestInit)=>{const r=await fetch("https://api.tryatria.com/open/v1"+path,{...init,headers:{"X-API-Key":process.env.ATRIA_API_KEY||"",Accept:"application/json","Content-Type":"application/json"},cache:"no-store"});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text)}catch{};return {status:r.status,code:body?.code,message:body?.message||body?.error||(body?null:text.slice(0,300)),data:body?.data}};
 if(req.nextUrl.searchParams.get("probe")==="atria-ads"){
  const id=req.nextUrl.searchParams.get("id")||"";const u=new URLSearchParams();const hex=id.replace(/-/g,"");if(/^[0-9a-f]{32}$/i.test(hex))u.append("unified_brand_id",`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`);else u.append("brand_id",id);u.append("status",req.nextUrl.searchParams.get("status")||"active");u.set("order","most_impressions");u.set("page_size","5");
  const r=await atriaRaw("/ad-library/search?"+u);const items=r.data?.items||[];
  return Response.json({status:r.status,code:r.code,message:r.message,total:r.data?.total,cursor:!!r.data?.cursor,count:items.length,
   sample:items.slice(0,3).map((a:any)=>({brand_id:a.brand_id,brand_name:a.brand_name,status:a.status,link_url:a.link_url,days_running:a.days_running,impression_rank:a.impression_rank}))});
 }
 if(req.nextUrl.searchParams.get("probe")==="atria"){
  const kw=req.nextUrl.searchParams.get("keyword");
  const r=await atriaRaw("/inspo-brands/search",{method:"POST",body:JSON.stringify({scope:"library",library:kw?{brand_name:kw,limit:5}:{host:domain,limit:5}})});
  return Response.json({status:r.status,code:r.code,message:r.message,
   items:(r.data?.items||[]).map((b:any)=>({id:b.id,name:b.name,primary_host:b.primary_host,hosts:b.hosts?.slice(0,6),ads:b.ads,advertisers:b.advertisers?.slice(0,4).map((a:any)=>({id:a.id,name:a.name,main:a.main,official:a.official,total_ads:a.total_ads,active_ads:a.active_ads}))}))});
 }
 const r=await pullMarketing(domain,req.nextUrl.searchParams.get("name")||"");
 const m=r.marketing,t=r.metrics;
 return Response.json({...status,reports:r.reports,trace:req.nextUrl.searchParams.get("trace")?trace.filter(x=>x.includes("tryatria")||x.includes("inspo-brands")||x.includes("ad-library")):undefined,
  metrics:t&&{monthlyVisits:t.monthlyVisits,aov:t.aov,revenue:t.revenue,bestsellers:t.bestsellers?.length,metaActiveAds:t.metaActiveAds,metaTotalAds:t.metaTotalAds},
  marketing:m&&{pages:m.meta?.pages?.length,personaPages:m.meta?.personaPageCount,topAds:m.meta?.topAds?.length,tiktokPosts:m.tiktok?.posts,instagramPosts:m.instagram?.posts,emails:m.email?.total,
   landing:m.landing&&{advertisers:m.landing.advertisers?.map(a=>`${a.name} (${a.role})`),landingPages:m.landing.landingPages?.slice(0,8).map(l=>`${l.host}${l.path} · ${l.kind} · ${l.activeAds}`),notes:m.landing.notes}}});
}
