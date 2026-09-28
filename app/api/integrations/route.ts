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
 const r=await pullMarketing(domain,req.nextUrl.searchParams.get("name")||"");
 const m=r.marketing,t=r.metrics;
 return Response.json({...status,reports:r.reports,
  metrics:t&&{monthlyVisits:t.monthlyVisits,aov:t.aov,revenue:t.revenue,bestsellers:t.bestsellers?.length,metaActiveAds:t.metaActiveAds,metaTotalAds:t.metaTotalAds},
  marketing:m&&{pages:m.meta?.pages?.length,personaPages:m.meta?.personaPageCount,topAds:m.meta?.topAds?.length,tiktokPosts:m.tiktok?.posts,instagramPosts:m.instagram?.posts,emails:m.email?.total,
   landing:m.landing&&{advertisers:m.landing.advertisers?.map(a=>`${a.name} (${a.role})`),landingPages:m.landing.landingPages?.slice(0,8).map(l=>`${l.host}${l.path} · ${l.kind} · ${l.activeAds}`),notes:m.landing.notes}}});
}
