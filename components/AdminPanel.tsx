"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,Check,Copy,KeyRound,Loader2,X} from "lucide-react";

type U={id:string;email:string;full_name:string;company:string;job_role:string;use_case:string;status:string;role:string;daily_research_limit:number|null;created_at:string;last_login_at?:string|null;researchToday:number;resetRequested:boolean};

export default function AdminPanel(){
 const [data,setData]=useState<{me:{id:string;role:string};defaultLimit:number;users:U[]}|null>(null);
 const [err,setErr]=useState("");const [busy,setBusy]=useState("");const [link,setLink]=useState<{id:string;url:string}|null>(null);const [copied,setCopied]=useState(false);
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
  <h2 className="adminH2">Waiting for approval · {pending.length}</h2>
  {pending.length?<div className="tableWrap"><table className="ptable adminTable"><thead><tr><th>Person</th><th>Use</th><th>Status</th><th>Research</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{pending.map(row)}</tbody></table></div>:<p className="dim">Nobody is waiting.</p>}
  <h2 className="adminH2">All accounts · {rest.length}</h2>
  <div className="tableWrap"><table className="ptable adminTable"><thead><tr><th>Person</th><th>Use</th><th>Status</th><th>Research</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{rest.map(row)}</tbody></table></div>
 </div>;
}
