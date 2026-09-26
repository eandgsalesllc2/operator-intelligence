import {NodeType} from "./types";
import {providers} from "./providers";
import {saveProviderFindings,updateResearchJob} from "./repository";

export async function runResearchJob(job:any){
 const seedType=job.seed_type as NodeType;
 await updateResearchJob(job.id,{status:"running",started_at:new Date().toISOString(),provider:"multi",progress:5,message:"Starting research providers"});
 let total=0;
 const active=providers.filter(p=>p.supports(seedType));
 try{
  for(let i=0;i<active.length;i++){
   const provider=active[i];
   await updateResearchJob(job.id,{provider:provider.name,progress:10+Math.floor((i/Math.max(active.length,1))*70),message:"Running "+provider.name+" research"});
   const findings=await provider.search(job.seed_value,seedType);
   await saveProviderFindings({investigationId:job.investigation_id,jobId:job.id,provider:provider.name,findings});
   total+=findings.length;
  }
  return await updateResearchJob(job.id,{status:"completed",provider:"multi",progress:100,message:"Research completed · "+total+" sources collected",completed_at:new Date().toISOString(),error:""});
 }catch(error){
  const message=error instanceof Error?error.message:"Research failed";
  await updateResearchJob(job.id,{status:"failed",message:"Research failed",error:message,completed_at:new Date().toISOString()});
  throw error;
 }
}
