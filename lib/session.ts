// Signed session cookies (Web Crypto, so it runs in middleware and route handlers alike).
// Cookie value: base64url(JSON payload) + "." + base64url(HMAC-SHA256). The signing key is SESSION_SECRET,
// or, when that is not set, a key derived from the server-only Supabase service-role key.
export const SESSION_COOKIE="oi_session";
export const SESSION_DAYS=14;
export type Session={uid:string;email:string;name:string;exp:number};

const enc=new TextEncoder();
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64url=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));

let keyPromise:Promise<CryptoKey>|null=null;
function key(){
 if(!keyPromise)keyPromise=(async()=>{
  const secret=process.env.SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)throw new Error("SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for sign-in");
  const raw=await crypto.subtle.digest("SHA-256",enc.encode("oi-session-v1:"+secret));
  return crypto.subtle.importKey("raw",raw,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
 })();
 return keyPromise;
}

export async function signSession(s:Omit<Session,"exp">):Promise<string>{
 const payload=b64url(enc.encode(JSON.stringify({...s,exp:Date.now()+SESSION_DAYS*864e5})));
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",await key(),enc.encode(payload)));
 return payload+"."+b64url(sig);
}

export async function verifySession(token?:string|null):Promise<Session|null>{
 if(!token)return null;
 const [payload,sig]=token.split(".");
 if(!payload||!sig)return null;
 try{
  const ok=await crypto.subtle.verify("HMAC",await key(),fromB64url(sig),enc.encode(payload));
  if(!ok)return null;
  const s=JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
  return s.exp>Date.now()?s:null;
 }catch{return null}
}

export async function sha256Hex(v:string){
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v)))].map(b=>b.toString(16).padStart(2,"0")).join("");
}
