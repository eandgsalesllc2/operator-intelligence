"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronUp,LogOut,PlayCircle,ShieldCheck} from "lucide-react";

export type Me={id:string;email:string;full_name:string;company:string;job_role:string;onboarded_at:string|null;role?:string};

export default function AccountMenu({me,onReplay}:{me:Me;onReplay:()=>void}){
 const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const f=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[open]);
 const initials=me.full_name.split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?";
 async function signOut(){await fetch("/api/auth/logout",{method:"POST"}).catch(()=>{});window.location.href="/login"}
 return <div className="acct" ref={ref}>
  {open&&<div className="acctMenu" role="menu"><div className="who"><b>{me.full_name}</b>{me.email}<br/>{me.job_role} · {me.company}</div>
   <button role="menuitem" onClick={()=>{setOpen(false);onReplay()}}><PlayCircle size={15}/> Replay the tour</button>
   {(me.role==="owner"||me.role==="admin")&&<a role="menuitem" className="menuLink" href="/admin"><ShieldCheck size={15}/> Admin · access &amp; accounts</a>}
   <button role="menuitem" onClick={signOut}><LogOut size={15}/> Sign out</button></div>}
  <button className="acctBtn" onClick={()=>setOpen(o=>!o)} aria-haspopup="menu" aria-expanded={open}><span className="acctAv">{initials}</span><span><b>{me.full_name}</b><small>{me.company}</small></span><ChevronUp size={14}/></button>
 </div>;
}
