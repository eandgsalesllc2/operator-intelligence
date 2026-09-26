import {NextRequest} from "next/server";
import {listResearchJobs,listResearchSources,queueResearchJob} from "@/lib/repository";
import {runResearchJob} from "@/lib/research-runner";

export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:NextRequest){
 try{
  const investigationId=req.nextUrl.searchParams.get("investigationId");
  if(!investigationId)return Response.json({error:"investigationId is required"},{status:400});
  const [jobs,sources]=await Promise.all([listResearchJobs(investigationId),listResearchSources(investigationId)]);
  return Response.json({jobs,sources});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Research lookup failed"},{status:500})}
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  if(!body.investigationId||!body.seedValue||!body.seedType)return Response.json({error:"investigationId, seedValue and seedType are required"},{status:400});
  const job=await queueResearchJob({investigationId:body.investigationId,seedEntityId:body.seedEntityId,seedValue:body.seedValue,seedType:body.seedType,maxDepth:body.maxDepth});
  const completed=await runResearchJob(job);
  return Response.json({job:completed},{status:201});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to run research"},{status:500})}
}
