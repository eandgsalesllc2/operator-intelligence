import {NextRequest} from "next/server";
import {getInvestigation} from "@/lib/repository";
import {fetchCreatives} from "@/lib/marketing-sources";

export const dynamic="force-dynamic";
export const maxDuration=60;
// GET ?investigationId= → the brand's live ad creatives (images/video) for the Marketing ad wall.
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get("investigationId");
 if(!id)return Response.json({error:"investigationId is required"},{status:400});
 try{
  const c=await getInvestigation(id);if(!c)return Response.json({error:"Investigation not found"},{status:404});
  const main=c.marketing?.landing?.advertisers?.find(a=>a.role==="main")?.id||null;
  return Response.json(await fetchCreatives(c.domain||"",main));
 }catch(e){return Response.json({creatives:[],error:e instanceof Error?e.message:"Could not load creatives"},{status:500})}
}
