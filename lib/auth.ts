// Accounts: scrypt password hashes in oi_users, read and written only with the server's service-role key.
import {createHash,randomBytes,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {cookies} from "next/headers";
import {SESSION_COOKIE,SESSION_DAYS,signSession,verifySession,type Session} from "./session";

const scrypt=promisify(scryptCb) as (p:string,s:Buffer,n:number,o:{N:number;r:number;p:number;maxmem:number})=>Promise<Buffer>;
const PARAMS={N:16384,r:8,p:1,maxmem:64*1024*1024};
const MAX_FAILED=5, LOCK_MINUTES=15;

export type User={id:string;email:string;full_name:string;company:string;job_role:string;use_case:string;onboarded_at:string|null;created_at:string;status:"pending"|"approved"|"rejected";role:"owner"|"admin"|"member";daily_research_limit:number|null;last_login_at?:string|null;watch_seen_at?:string|null};
const PUBLIC_FIELDS="id,email,full_name,company,job_role,use_case,onboarded_at,created_at,status,role,daily_research_limit,last_login_at,watch_seen_at";
export const isAdmin=(u?:User|null)=>!!u&&u.status==="approved"&&(u.role==="owner"||u.role==="admin");
export const DEFAULT_DAILY_RESEARCH=Number(process.env.RESEARCH_DAILY_LIMIT||20);

async function db(path:string,init?:RequestInit){
 const url=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!k)throw new Error("Database is not configured");
 const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});
 if(!r.ok)throw new Error(await r.text());
 return (async()=>{const t=await r.text();return t?JSON.parse(t):null})();
}

export async function hashPassword(password:string){
 const salt=randomBytes(16);
 const hash=await scrypt(password.normalize("NFKC"),salt,64,PARAMS);
 return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}
async function checkPassword(password:string,stored:string){
 const [alg,N,r,p,salt,hash]=stored.split("$");
 if(alg!=="scrypt")return false;
 const want=Buffer.from(hash,"base64");
 const got=await scrypt(password.normalize("NFKC"),Buffer.from(salt,"base64"),want.length,{N:+N,r:+r,p:+p,maxmem:PARAMS.maxmem});
 return got.length===want.length&&timingSafeEqual(got,want);
}

export const normalizeEmail=(e:string)=>e.trim().toLowerCase();

export function passwordProblem(p:string){
 if(p.length<10)return "Use at least 10 characters.";
 if(!/[a-z]/i.test(p)||!/\d/.test(p))return "Use letters and at least one number.";
 return null;
}

export async function findUserByEmail(email:string){
 const rows=await db(`oi_users?email=eq.${encodeURIComponent(normalizeEmail(email))}&select=*&limit=1`);
 return rows?.[0]||null;
}
export async function getUser(id:string):Promise<User|null>{
 const rows=await db(`oi_users?id=eq.${encodeURIComponent(id)}&select=${PUBLIC_FIELDS}&limit=1`);
 return rows?.[0]||null;
}

export async function createUser(u:{email:string;password:string;full_name:string;company:string;job_role:string;use_case:string}):Promise<User>{
 const rows=await db(`oi_users?select=${PUBLIC_FIELDS}`,{method:"POST",body:JSON.stringify({email:normalizeEmail(u.email),password_hash:await hashPassword(u.password),full_name:u.full_name,company:u.company,job_role:u.job_role,use_case:u.use_case,accepted_terms_at:new Date().toISOString()})});
 return rows[0];
}

// Returns the user on success, or a reason. Locks the account for a while after repeated failures.
export async function authenticate(email:string,password:string):Promise<{user?:User;error?:string}>{
 const row=await findUserByEmail(email);
 const generic="That email and password don't match an account.";
 if(!row){await checkPassword(password,"scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$"+"A".repeat(86)+"==").catch(()=>{});return {error:generic}}
 if(row.locked_until&&new Date(row.locked_until).getTime()>Date.now())return {error:`Too many failed attempts. Try again after ${new Date(row.locked_until).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}.`};
 if(!(await checkPassword(password,row.password_hash))){
  const failed=(row.failed_logins||0)+1;
  await db(`oi_users?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify(failed>=MAX_FAILED?{failed_logins:0,locked_until:new Date(Date.now()+LOCK_MINUTES*6e4).toISOString()}:{failed_logins:failed})});
  return {error:failed>=MAX_FAILED?`Too many failed attempts. The account is locked for ${LOCK_MINUTES} minutes.`:generic};
 }
 if(row.status==="pending")return {error:"Your account is waiting for approval. You'll be able to sign in once an admin approves it."};
 if(row.status==="rejected")return {error:"This account hasn't been approved for access."};
 await db(`oi_users?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify({failed_logins:0,locked_until:null,last_login_at:new Date().toISOString()})});
 return {user:(await getUser(row.id))!};
}

export async function markOnboarded(id:string,done:boolean){
 await db(`oi_users?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({onboarded_at:done?new Date().toISOString():null})});
}

export async function startSession(u:User){
 const token=await signSession({uid:u.id,email:u.email,name:u.full_name});
 (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:SESSION_DAYS*86400});
}
export async function endSession(){(await cookies()).delete(SESSION_COOKIE)}
export async function currentSession():Promise<Session|null>{return verifySession((await cookies()).get(SESSION_COOKIE)?.value)}

// ---------- admin ----------
export async function currentUser():Promise<User|null>{const s=await currentSession();if(!s)return null;return getUser(s.uid).catch(()=>null)}
export async function listUsers():Promise<User[]>{return await db(`oi_users?select=${PUBLIC_FIELDS}&order=created_at.desc`)}
export async function updateUser(id:string,patch:Partial<Pick<User,"status"|"role"|"daily_research_limit">>){
 const rows=await db(`oi_users?id=eq.${encodeURIComponent(id)}&select=${PUBLIC_FIELDS}`,{method:"PATCH",body:JSON.stringify(patch)});return rows?.[0]||null;
}

// ---------- password reset ----------
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function createResetToken(userId:string,hours=1){
 await db(`oi_password_resets?user_id=eq.${encodeURIComponent(userId)}&used_at=is.null`,{method:"PATCH",body:JSON.stringify({used_at:new Date().toISOString()})}); // one live link per user
 const token=randomBytes(32).toString("base64url");
 await db("oi_password_resets",{method:"POST",body:JSON.stringify({user_id:userId,token_hash:sha(token),expires_at:new Date(Date.now()+hours*60*60e3).toISOString()})});
 return token;
}
export async function pendingResetRequests(){return await db("oi_password_resets?used_at=is.null&expires_at=gt."+encodeURIComponent(new Date().toISOString())+"&select=user_id,created_at,expires_at&order=created_at.desc")}
export async function resetPassword(token:string,password:string,acceptedTerms=false):Promise<{ok?:true;error?:string}>{
 const rows=await db(`oi_password_resets?token_hash=eq.${sha(token)}&select=id,user_id,expires_at,used_at&limit=1`);const r=rows?.[0];
 if(!r||r.used_at||new Date(r.expires_at).getTime()<Date.now())return {error:"This reset link has expired or was already used. Ask for a new one."};
 await db(`oi_users?id=eq.${r.user_id}`,{method:"PATCH",body:JSON.stringify({password_hash:await hashPassword(password),failed_logins:0,locked_until:null,...(acceptedTerms?{accepted_terms_at:new Date().toISOString()}:{})})});
 await db(`oi_password_resets?id=eq.${r.id}`,{method:"PATCH",body:JSON.stringify({used_at:new Date().toISOString()})});
 return {ok:true};
}
// Sends the reset email when an email service is configured (Resend); otherwise an admin shares the link.
export async function sendResetEmail(to:string,link:string){
 const key=process.env.RESEND_API_KEY,from=process.env.RESET_FROM_EMAIL;if(!key||!from)return false;
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject:"Reset your BrandTracer password",text:`Someone asked to reset the password for your BrandTracer account.\n\nReset it here (the link works for one hour, once):\n${link}\n\nIf this wasn't you, ignore this email.`})});
 return r.ok;
}
export async function researchCountToday(userId:string){
 const since=new Date();since.setUTCHours(0,0,0,0);
 const url=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(`${url}/rest/v1/oi_research_jobs?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since.toISOString())}&select=id`,{headers:{apikey:k!,Authorization:"Bearer "+k,Prefer:"count=exact",Range:"0-0"},cache:"no-store"});
 return Number(r.headers.get("content-range")?.split("/")[1]||0);
}

// Admin-created account: approved from the start, with an unusable random password until the person sets their own
// through a 7-day setup link (the admin never sees or chooses a password).
export async function adminCreateUser(u:{email:string;full_name:string;company:string;job_role:string;role:"member"|"admin";createdBy:string}):Promise<{user:User;token:string}>{
 const rows=await db(`oi_users?select=${PUBLIC_FIELDS}`,{method:"POST",body:JSON.stringify({email:normalizeEmail(u.email),password_hash:await hashPassword(randomBytes(32).toString("base64url")),full_name:u.full_name,company:u.company,job_role:u.job_role,use_case:`Account created by an admin (${u.createdBy})`,status:"approved",role:u.role})});
 const user=rows[0] as User;
 return {user,token:await createResetToken(user.id,24*7)};
}
export async function sendInviteEmail(to:string,name:string,link:string,inviter:string){
 const key=process.env.RESEND_API_KEY,from=process.env.RESET_FROM_EMAIL;if(!key||!from)return false;
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject:"You're invited to BrandTracer",text:`Hi ${name.split(" ")[0]||"there"},\n\n${inviter} created a BrandTracer account for you.\n\nSet your password and sign in here (the link works once, for 7 days):\n${link}\n`})});
 return r.ok;
}
