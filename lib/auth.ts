// Accounts: scrypt password hashes in oi_users, read and written only with the server's service-role key.
import {randomBytes,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {cookies} from "next/headers";
import {SESSION_COOKIE,SESSION_DAYS,signSession,verifySession,type Session} from "./session";

const scrypt=promisify(scryptCb) as (p:string,s:Buffer,n:number,o:{N:number;r:number;p:number;maxmem:number})=>Promise<Buffer>;
const PARAMS={N:16384,r:8,p:1,maxmem:64*1024*1024};
const MAX_FAILED=5, LOCK_MINUTES=15;

export type User={id:string;email:string;full_name:string;company:string;job_role:string;use_case:string;onboarded_at:string|null;created_at:string};
const PUBLIC_FIELDS="id,email,full_name,company,job_role,use_case,onboarded_at,created_at";

async function db(path:string,init?:RequestInit){
 const url=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!k)throw new Error("Database is not configured");
 const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});
 if(!r.ok)throw new Error(await r.text());
 return r.status===204?null:r.json();
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
