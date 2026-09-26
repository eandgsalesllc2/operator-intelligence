import {NextRequest,after} from "next/server";
import {NodeType} from "@/lib/types";
import {databaseConfigured,getInvestigation,getResearchJob,listResearchJobs,listResearchSources,queueResearchJob,saveInvestigation,updateResearchJob} from "@/lib/repository";
import {guessSeedType,newCase,normalizeSeed,runResearchJob} from "@/lib/research-runner";
import {aiResearchEnabled} from "@/lib/ai-research";

export const dynamic="force-dynamic";
export const maxDuration=300;

const TYPES:NodeType[]=["brand","person","company","trademark","domain","address","phone","email"];
const STALE_MS=7*60*1000;

export async function GET(req:NextRequest){
 try{
  const jobId=req.nextUrl.searchParams.get("jobId");
  if(jobId){
   let job=await getResearchJob(jobId);
   if(!job)return Response.json({error:"Job not found"},{status:404});
   // A job still "running" long after the function limit was cut off mid-run.
   if((job.status==="running"||job.status==="queued")&&Date.now()-new Date(job.updated_at||job.created_at).getTime()>STALE_MS)
    job=await updateResearchJob(job.id,{status:"failed",message:"Research timed out before finishing. Run it again; results collected so far were kept.",error:"timeout",completed_at:new Date().toISOString()});
   return Response.json({job});
  }
  const investigationId=req.nextUrl.searchParams.get("investigationId");
  if(!investigationId)return Response.json({webResearch:aiResearchEnabled(),database:databaseConfigured()});
  const [jobs,sources]=await Promise.all([listResearchJobs(investigationId),listResearchSources(investigationId)]);
  return Response.json({jobs,sources,webResearch:aiResearchEnabled()});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Research lookup failed"},{status:500})}
}

// Body: {seedValue, seedType?, name?, investigationId?, seedEntityId?}
// Without investigationId a new investigation is created from the seed.
export async function POST(req:NextRequest){
 try{
  if(!databaseConfigured())return Response.json({error:"Research needs the database (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)."},{status:503});
  const body=await req.json();
  const raw=String(body.seedValue||"").trim();
  if(!raw)return Response.json({error:"Enter something to research: a brand, domain, person, company, trademark, address, phone or email."},{status:400});
  if(raw.length>300)return Response.json({error:"Seed is too long"},{status:400});
  const seedType:NodeType=TYPES.includes(body.seedType)?body.seedType:guessSeedType(raw);
  const seedValue=normalizeSeed(raw,seedType);
  let investigationId:string=body.investigationId||"";
  let created=null;
  if(investigationId){
   if(!await getInvestigation(investigationId))return Response.json({error:"Investigation not found"},{status:404});
  }else{
   created=newCase(seedValue,seedType,body.name);
   await saveInvestigation(created);
   investigationId=created.id;
  }
  const job=await queueResearchJob({investigationId,seedEntityId:body.seedEntityId||(created?created.id+":seed":null),seedValue,seedType,maxDepth:body.maxDepth});
  after(()=>runResearchJob(job));
  return Response.json({job,investigationId,case:created,webResearch:aiResearchEnabled()},{status:202});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to start research"},{status:500})}
}
