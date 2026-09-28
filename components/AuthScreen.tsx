"use client";
import {useState} from "react";
import {ArrowRight,Eye,EyeOff,Loader2,ShieldCheck,Search,Megaphone} from "lucide-react";

const ROLES=["Founder / owner","Media buyer","Marketing","Investor / M&A","Legal / compliance","Research / analyst","Agency","Other"];

export default function AuthScreen({mode,next}:{mode:"login"|"signup";next?:string}){
 const signup=mode==="signup";
 const [f,setF]=useState({email:"",password:"",fullName:"",company:"",role:"",useCase:"",acceptTerms:false});
 const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const set=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setF(p=>({...p,[k]:e.target.type==="checkbox"?(e.target as HTMLInputElement).checked:e.target.value}));
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{
   const r=await fetch(signup?"/api/auth/signup":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(signup?f:{email:f.email,password:f.password})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok){setError(d.error||"Something went wrong.");setBusy(false);return}
   window.location.href=next&&next.startsWith("/")&&!next.startsWith("//")?next:"/";
  }catch{setError("Network error. Check your connection and try again.");setBusy(false)}
 }
 return <div className="auth">
  <section className="authStory">
   <a className="logo logoBtn" href="/" aria-label="BrandTracer home"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="2"/><path d="M20 20l7 7" stroke="#c2412d" strokeWidth="3" strokeLinecap="round"/><circle cx="13" cy="13" r="3" fill="#c2412d"/></svg><span className="wordmark">BrandTracer</span></a>
   <div className="authPitch">
    <div className="authTab">CASE FILE № 0001</div>
    <h1>See who is really behind every DTC brand.</h1>
    <p>Owners, operators, sister brands, trademarks, ad networks and funnels — mapped with sources and a strict evidence standard.</p>
    <ul>
     <li><Search size={16}/><span><b>Search anything</b> — a brand, domain, person, company, email or phone.</span></li>
     <li><ShieldCheck size={16}/><span><b>Evidence first</b> — every link is rated Confirmed, Strong, Correlation or Lead.</span></li>
     <li><Megaphone size={16}/><span><b>Whole marketing picture</b> — traffic, revenue, Meta ads, persona pages and live landing pages.</span></li>
    </ul>
   </div>
   <svg className="authGraph" viewBox="0 0 360 280" aria-hidden="true"><g stroke="#816745" strokeWidth="1.2"><line x1="180" y1="140" x2="70" y2="70"/><line x1="180" y1="140" x2="300" y2="55"/><line x1="180" y1="140" x2="90" y2="225"/><line x1="180" y1="140" x2="285" y2="220"/><line x1="300" y1="55" x2="285" y2="220" strokeDasharray="4 5"/><line x1="70" y1="70" x2="90" y2="225" strokeDasharray="4 5"/></g>{[[180,140,13,"#ce4530"],[70,70,8,"#37c68b"],[300,55,8,"#e9b949"],[90,225,8,"#ce4530"],[285,220,8,"#37c68b"]].map(([x,y,r,c],i)=><g key={i} className="gn" style={{animationDelay:`${i*.4}s`,transformOrigin:`${x}px ${y}px`}}><circle cx={x as number} cy={y as number} r={(r as number)+7} fill={c as string} opacity=".15"/><circle cx={x as number} cy={y as number} r={r as number} fill={c as string}/></g>)}</svg>
  </section>
  <section className="authPanel">
   <form className="authCard" onSubmit={submit} noValidate>
    <h2>{signup?"Create your account":"Sign in"}</h2>
    <p className="dim">{signup?"Access is limited to registered users. Tell us who you are.":"Welcome back. Sign in to your investigations."}</p>
    {signup&&<><label>Full name<input autoComplete="name" value={f.fullName} onChange={set("fullName")} required/></label>
     <label>Company<input autoComplete="organization" value={f.company} onChange={set("company")} required/></label>
     <label>Your role<select value={f.role} onChange={set("role")} required><option value="" disabled>Choose one…</option>{ROLES.map(r=><option key={r}>{r}</option>)}</select></label></>}
    <label>Email<input type="email" autoComplete="email" value={f.email} onChange={set("email")} required/></label>
    <label>Password<span className="pw"><input type={show?"text":"password"} autoComplete={signup?"new-password":"current-password"} value={f.password} onChange={set("password")} required minLength={signup?10:undefined}/><button type="button" onClick={()=>setShow(s=>!s)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span>{signup&&<small className="dim">At least 10 characters, with letters and a number.</small>}</label>
    {signup&&<><label>What will you use it for?<textarea rows={3} value={f.useCase} onChange={set("useCase")} placeholder="e.g. Vetting competitors and acquisition targets in supplements" required/></label>
     <label className="check"><input type="checkbox" checked={f.acceptTerms} onChange={set("acceptTerms")}/><span>I'll use BrandTracer for business research only — company and business-role information, never private individuals' home addresses, personal contacts or family details.</span></label></>}
    {error&&<div className="authError" role="alert">{error}</div>}
    <button className="authSubmit" disabled={busy}>{busy?<Loader2 size={16} className="spin"/>:<ArrowRight size={16}/>}{signup?"Create account":"Sign in"}</button>
    <p className="authSwitch">{signup?<>Already have an account? <a href={"/login"+(next?`?next=${encodeURIComponent(next)}`:"")}>Sign in</a></>:<>New here? <a href={"/signup"+(next?`?next=${encodeURIComponent(next)}`:"")}>Create an account</a></>}</p>
   </form>
  </section>
 </div>;
}
