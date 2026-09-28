import {adminCreateUser,currentUser,findUserByEmail,isAdmin,listUsers,normalizeEmail,pendingResetRequests,researchCountToday,sendInviteEmail,updateUser,DEFAULT_DAILY_RESEARCH} from "@/lib/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const deny=()=>Response.json({error:"Admins only."},{status:403});

export async function GET(){
 const me=await currentUser();if(!isAdmin(me))return deny();
 const [users,resets]=await Promise.all([listUsers(),pendingResetRequests()]);
 const usage=await Promise.all(users.map(u=>researchCountToday(u.id).catch(()=>0)));
 const resetFor=new Set((resets||[]).map((r:any)=>r.user_id));
 return Response.json({me:{id:me!.id,role:me!.role},defaultLimit:DEFAULT_DAILY_RESEARCH,users:users.map((u,i)=>({...u,researchToday:usage[i],resetRequested:resetFor.has(u.id)}))});
}

// PATCH {id, status?, role?, daily_research_limit?}
export async function PATCH(req:Request){
 const me=await currentUser();if(!isAdmin(me))return deny();
 const b=await req.json().catch(()=>({}));const id=String(b.id||"");if(!id)return Response.json({error:"Missing user id."},{status:400});
 const patch:any={};
 if(["pending","approved","rejected"].includes(b.status))patch.status=b.status;
 if(["admin","member"].includes(b.role)){if(me!.role!=="owner")return Response.json({error:"Only the owner can change roles."},{status:403});patch.role=b.role}
 if(b.daily_research_limit===null||(Number.isInteger(b.daily_research_limit)&&b.daily_research_limit>=0&&b.daily_research_limit<=1000))patch.daily_research_limit=b.daily_research_limit;
 const target=(await listUsers()).find(u=>u.id===id);if(!target)return Response.json({error:"User not found."},{status:404});
 if(target.role==="owner"&&(patch.status||patch.role))return Response.json({error:"The owner account can't be changed here."},{status:400});
 return Response.json({user:await updateUser(id,patch)});
}

// POST {email, fullName, company, jobRole, role} → create an approved account and return a 7-day setup link.
const JOB_ROLES=["Founder / owner","Media buyer","Marketing","Investor / M&A","Legal / compliance","Research / analyst","Agency","Other"];
export async function POST(req:Request){
 const me=await currentUser();if(!isAdmin(me))return deny();
 const b=await req.json().catch(()=>({}));
 const clean=(v:unknown,n=160)=>String(v??"").replace(/\s+/g," ").trim().slice(0,n);
 const email=normalizeEmail(clean(b.email,254)),full_name=clean(b.fullName,120),company=clean(b.company)||"—",job_role=JOB_ROLES.includes(b.jobRole)?b.jobRole:"Other";
 const role=b.role==="admin"?"admin":"member";
 if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))return Response.json({error:"Enter a valid email address."},{status:400});
 if(full_name.length<2)return Response.json({error:"Enter their full name."},{status:400});
 if(role==="admin"&&me!.role!=="owner")return Response.json({error:"Only the owner can create admins."},{status:403});
 if(await findUserByEmail(email))return Response.json({error:"An account with this email already exists."},{status:409});
 const {user,token}=await adminCreateUser({email,full_name,company,job_role,role,createdBy:me!.full_name});
 const link=`${new URL(req.url).origin}/reset?token=${token}&invite=1`;
 const emailed=await sendInviteEmail(user.email,user.full_name,link,me!.full_name).catch(()=>false);
 return Response.json({user,link,emailed});
}
