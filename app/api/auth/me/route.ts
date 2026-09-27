import {currentSession,endSession,getUser} from "@/lib/auth";

export const runtime="nodejs";
export async function GET(){
 const s=await currentSession();
 if(!s)return Response.json({user:null},{status:401});
 let user;
 try{user=await getUser(s.uid)}catch{return Response.json({user:null,error:"Account service unavailable"},{status:503})}
 // Signed cookie for an account that no longer exists: clear it so the sign-in page doesn't bounce back here.
 if(!user){await endSession();return Response.json({user:null},{status:401})}
 return Response.json({user});
}
