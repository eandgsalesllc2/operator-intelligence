"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,Check,Copy,KeyRound,Loader2,UserPlus,X} from "lucide-react";

type U={id:string;email:string;full_name:string;company:string;job_role:string;use_case:string;status:string;role:string;daily_research_limit:number|null;created_at:string;last_login_at?:string|null;researchToday:number;resetRequested:boolean};

export default function AdminPanel(){
 const [data,setData]=useState<{me:{id:string;role:string};defaultLimit:number;users:U[]}|null>(null);
 const [err,setErr]=useState("");const [nu,setNu]=useState({fullName:"",email:"",company:"",jobRole:"Research / analyst",role:"member"});const [created,setCreated]=useState<{name:string;email:string;link:string;emailed:boolean}|null>(null);const [creating,setCreating]=useState(false);const [copiedNew,setCopiedNew]=useState(false);
 const createAccount=async(e:React.FormEvent)=>{e.preventDefault();setCreating(true);setErr("");setCreated(null);setCopiedNew(false);const r=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(nu)});const d=await r.json().catch(()=>({}));if(!r.ok)setErr(d.error||"Could not create the account.");else{setCreated({name:d.user.full_name,email:d.user.email,link:d.link,emailed:d.emailed});setNu({fullName:"",email:"",company:"",jobRole:"Research / analyst",role:"member"});await load()}setCreating(false)};const [busy,setBusy]=useState("");const [link,setLink]=useState<{id:string;url:string}|null>(null);const [copied,setCopied]=useState(false);
 const load=()=>fetch("/api/admin/users",{cache:"no-store"}).then(r=>r.json()).then(d=>d.error?setErr(d.error):setData(d)).catch(()=>setErr("Could not load accounts."));
 useEffect(()=>{load()},[]);
 const patch=async(id:string,body:object)=>{setBusy(id);setErr("");const r=await fetch("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...body})});const d=await r.json();if(!r.ok)setErr(d.error||"Update failed");await load();setBusy("")};
 const resetLink=async(id:string)=>{setBusy(id);setCopied(false);const r=await fetch("/api/admin/resets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:id})});const d=await r.json();if(!r.ok)setErr(d.error||"Could not create a link");else setLink({id,url:d.link});setBusy("")};
 if(!data)return <div className="adminWrap"><p className="pfEmpty">{err||<><Loader2 size={16} className="spin"/> Loading accounts…</>}</p></div>;
 const pending=data.users.filter(u=>u.status==="pending"),rest=data.users.filter(u=>u.status!=="pending");
 const row=(u:U)=><tr key={u.id}>
  <td><b>{u.full_name}</b><div className="dim small">{u.email}</div><div className="dim small">{u.job_role} · {u.company}</div></td>
  <td className="small useCase">{u.use_case}</td>
  <td><span className={"statusPill "+u.status}>{u.status}</span>{u.role!=="member"&&<span className="statusPill role">{u.role}</span>}</td>
  <td className="small">{u.researchToday} today<br/><label className="limit">limit <input type="number" min={0} max={1000} aria-label={`Daily research limit for ${u.full_name}`} disabled={u.role!=="member"||busy===u.id} defaultValue={u.daily_research_limit??""} placeholder={String(data.defaultLimit)} onBlur={e=>{const v=e.target.value.trim();const n=v===""?null:Math.max(0,Math.min(1000,parseInt(v,10)));if(n!==u.daily_research_limit)patch(u.id,{daily_research_limit:n})}}/></label></td>
  <td className="small">{new Date(u.created_at).toLocaleDateString()}<br/><span className="dim">{u.last_login_at?`last in ${new Date(u.last_login_at).toLocaleDateString()}`:"never signed in"}</span></td>
  <td className="actions">{u.role==="owner"?<span className="dim small">Owner</span>:<>
   {u.status!=="approved"&&<button className="ok" disabled={busy===u.id} onClick={()=>patch(u.id,{status:"approved"})}><Check size={14}/> Approve</button>}
   {u.status!=="rejected"&&<button className="no" disabled={busy===u.id} onClick={()=>patch(u.id,{status:"rejected"})}><X size={14}/> {u.status==="approved"?"Revoke":"Reject"}</button>}
   {data.me.role==="owner"&&u.status==="approved"&&<button disabled={busy===u.id} onClick={()=>patch(u.id,{role:u.role==="admin"?"member":"admin"})}>{u.role==="admin"?"Make member":"Make admin"}</button>}
   </>}
   {u.status==="approved"&&<button disabled={busy===u.id} onClick={()=>resetLink(u.id)} className={u.resetRequested?"hot":""}><KeyRound size={14}/> {u.resetRequested?"Reset requested · get link":"Reset link"}</button>}
   {link?.id===u.id&&<div className="resetLink"><input readOnly value={link.url} aria-label="Password reset link" onFocus={e=>e.target.select()}/><button onClick={()=>{navigator.clipboard?.writeText(link.url);setCopied(true)}}><Copy size={14}/> {copied?"Copied":"Copy"}</button><span className="dim small">Works once, for 60 minutes. Send it to {u.email} yourself.</span></div>}
  </td></tr>;
 return <div className="adminWrap">
  <a href="/" className="backLink"><ArrowLeft size={15}/> Back to case files</a>
  <div className="pfKicker">ADMIN</div><h1 className="adminTitle">Access &amp; accounts</h1>
  <p className="dim">New sign-ups wait here until you approve them. Members can run {data.defaultLimit} research jobs a day unless you set their own limit; owners and admins are unlimited.</p>
  {err&&<div className="authError" role="alert">{err}</div>}
  <section className="addAcct"><h2 className="adminH2"><UserPlus size={18}/> Add an account</h2>
   <form onSubmit={createAccount} className="addForm">
    <label>Full name<input required value={nu.fullName} onChange={e=>setNu(v=>({...v,fullName:e.target.value}))} autoComplete="off"/></label>
    <label>Email<input required type="email" value={nu.email} onChange={e=>setNu(v=>({...v,email:e.target.value}))} autoComplete="off"/></label>
    <label>Company<input value={nu.company} onChange={e=>setNu(v=>({...v,company:e.target.value}))} autoComplete="off"/></label>
    <label>Their role<select value={nu.jobRole} onChange={e=>setNu(v=>({...v,jobRole:e.target.value}))}>{["Founder / owner","Media buyer","Marketing","Investor / M&A","Legal / compliance","Research / analyst","Agency","Other"].map(r=><option key={r}>{r}</option>)}</select></label>
    <label>Access<select value={nu.role} onChange={e=>setNu(v=>({...v,role:e.target.value}))}><option value="member">Member</option>{data.me.role==="owner"&&<option value="admin">Admin</option>}</select></label>
    <button className="authSubmit" disabled={creating}>{creating?<Loader2 size={15} className="spin"/>:<UserPlus size={15}/>} Create account</button>
   </form>
   {created&&<div className="createdBox"><b>{created.name}&apos;s account is ready.</b> {created.emailed?<>We emailed a setup link to {created.email}.</>:<>Send this setup link to {created.email} — they choose their own password (works once, for 7 days):</>}
    <div className="resetLink"><input readOnly value={created.link} aria-label="Account setup link" onFocus={e=>e.target.select()}/><button type="button" onClick={()=>{navigator.clipboard?.writeText(created.link);setCopiedNew(true)}}><Copy size={14}/> {copiedNew?"Copied":"Copy"}</button></div></div>}
  </section>
  <h2 className="adminH2">Waiting for approval · {pending.length}</h2>
  {pending.length?<div className="tableWrap"><table className="ptable adminTable"><thead><tr><th>Person</th><th>Use</th><th>Status</th><th>Research</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{pending.map(row)}</tbody></table></div>:<p className="dim">Nobody is waiting.</p>}
  <h2 className="adminH2">All accounts · {rest.length}</h2>
  <div className="tableWrap"><table className="ptable adminTable"><thead><tr><th>Person</th><th>Use</th><th>Status</th><th>Research</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{rest.map(row)}</tbody></table></div>
 </div>;
}
