import {createUser,findUserByEmail,normalizeEmail,passwordProblem} from "@/lib/auth";

export const runtime="nodejs";
const ROLES=["Founder / owner","Media buyer","Marketing","Investor / M&A","Legal / compliance","Research / analyst","Agency","Other"];
const clean=(v:unknown,max=200)=>String(v??"").replace(/\s+/g," ").trim().slice(0,max);

export async function POST(req:Request){
 try{
  const b=await req.json().catch(()=>({}));
  const email=normalizeEmail(clean(b.email,254)),password=String(b.password??"");
  const full_name=clean(b.fullName,120),company=clean(b.company,160),job_role=clean(b.role,60),use_case=clean(b.useCase,600);
  if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))return Response.json({error:"Enter a valid email address."},{status:400});
  if(full_name.length<2)return Response.json({error:"Enter your full name."},{status:400});
  if(company.length<2)return Response.json({error:"Enter your company."},{status:400});
  if(!ROLES.includes(job_role))return Response.json({error:"Choose your role."},{status:400});
  if(use_case.length<10)return Response.json({error:"Tell us in a sentence what you'll use BrandTracer for."},{status:400});
  if(b.acceptTerms!==true)return Response.json({error:"Please accept the research rules to continue."},{status:400});
  const weak=passwordProblem(password);if(weak)return Response.json({error:weak},{status:400});
  if(await findUserByEmail(email))return Response.json({error:"An account with this email already exists. Sign in instead."},{status:409});
  // New accounts wait in the approval queue; an admin approves them on /admin.
  await createUser({email,password,full_name,company,job_role,use_case});
  return Response.json({pending:true});
 }catch(e){return Response.json({error:e instanceof Error&&/duplicate/i.test(e.message)?"An account with this email already exists.":"Sign-up failed. Please try again."},{status:500})}
}
