import {NextRequest} from "next/server";
import {atriaEnabled,brandsearchEnabled,pullMarketing} from "@/lib/marketing-sources";

export const dynamic="force-dynamic";
export const maxDuration=120;

// GET → which data sources are configured. GET ?domain=x&name=y → run both pulls for that brand and summarise
// what came back (sign-in required via middleware; never returns key values).
export async function GET(req:NextRequest){
 const domain=req.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
 const status={brandsearch:brandsearchEnabled(),atria:atriaEnabled()};
 if(!domain)return Response.json(status);
 // ?probe=atria&keyword=x → status and shape of one raw Atria brand search (for diagnosing matches).
 if(req.nextUrl.searchParams.get("probe")==="atria-ads"){
  const u=new URL(`https://api.tryatria.com/open/v1/brand-library/${encodeURIComponent(req.nextUrl.searchParams.get("id")||"")}/ads`);
  for(const [k,v] of req.nextUrl.searchParams)if(!["probe","id","domain"].includes(k))u.searchParams.append(k,v);
  const r=await fetch(u,{headers:{"X-API-Key":process.env.ATRIA_API_KEY||"",Accept:"application/json"},cache:"no-store"});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text)}catch{}
  const items=body?.data?.items||[];
  return Response.json({status:r.status,message:body?.message||body?.errorMessage||(body?null:text.slice(0,300)),total:body?.data?.total,cursor:!!body?.data?.cursor,count:items.length,
   sample:items.slice(0,3).map((a:any)=>({brand_name:a.brand_name,status:a.status,link_url:a.link_url,days_running:a.days_running,impression_rank:a.impression_rank}))});
 }
 if(req.nextUrl.searchParams.get("probe")==="atria"){
  const u=new URL("https://api.tryatria.com/open/v1/brand-library/search");u.searchParams.set("keyword",req.nextUrl.searchParams.get("keyword")||domain);u.searchParams.set("page_size","5");
  const r=await fetch(u,{headers:{"X-API-Key":process.env.ATRIA_API_KEY||"",Accept:"application/json"},cache:"no-store"});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text)}catch{}
  const items=body?.data?.items||body?.items||[];
  return Response.json({status:r.status,topKeys:body?Object.keys(body):null,dataKeys:body?.data?Object.keys(body.data):null,message:body?.message||body?.errorMessage||(body?null:text.slice(0,200)),
   items:items.slice(0,5).map((b:any)=>({id:b.id,name:b.name,website_url:b.website_url,ad_num:b.ad_num,source_library:b.source_library}))});
 }
 const r=await pullMarketing(domain,req.nextUrl.searchParams.get("name")||"");
 const m=r.marketing,t=r.metrics;
 return Response.json({...status,reports:r.reports,
  metrics:t&&{monthlyVisits:t.monthlyVisits,aov:t.aov,revenue:t.revenue,bestsellers:t.bestsellers?.length,metaActiveAds:t.metaActiveAds,metaTotalAds:t.metaTotalAds},
  marketing:m&&{pages:m.meta?.pages?.length,personaPages:m.meta?.personaPageCount,topAds:m.meta?.topAds?.length,tiktokPosts:m.tiktok?.posts,instagramPosts:m.instagram?.posts,emails:m.email?.total,
   landing:m.landing&&{advertisers:m.landing.advertisers?.map(a=>`${a.name} (${a.role})`),landingPages:m.landing.landingPages?.slice(0,8).map(l=>`${l.host}${l.path} · ${l.kind} · ${l.activeAds}`),notes:m.landing.notes}}});
}
