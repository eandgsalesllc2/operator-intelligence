import {networkClusters} from "@/lib/repository";

export const dynamic="force-dynamic";
export async function GET(){
 try{return Response.json({clusters:await networkClusters()})}
 catch(e){return Response.json({error:e instanceof Error?e.message:"Could not build networks"},{status:500})}
}
