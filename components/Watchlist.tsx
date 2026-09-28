"use client";
import {useEffect,useState} from "react";
import {Loader2,RefreshCw,Star,StarOff} from "lucide-react";
import {Case} from "@/lib/types";
import {compact} from "@/lib/metrics";
import SiteLink from "./SiteLink";

export type WatchChange={id:string;investigation_id:string;detected_at:string;kind:string;severity:"info"|"notable"|"major";title:string;detail?:string|null};
export type WatchData={items:{investigation_id:string;created_at:string;lastChecked:string|null}[];changes:WatchChange[];unread:number;seenAt:string|null;weeklyScheduled:boolean};

const ago=(iso?:string|null)=>{if(!iso)return "not checked yet";const d=(Date.now()-new Date(iso).getTime())/864e5;return d<1/24?"just now":d<1?`${Math.round(d*24)}h ago`:`${Math.round(d)}d ago`};
export const SEV:Record<string,string>={major:"bad",notable:"warn",info:"lead"};

export function ChangeItem({ch,name,unread,onOpen}:{ch:WatchChange;name?:string;unread?:boolean;onOpen?:()=>void}){
 const inner=<><span className={"tag "+SEV[ch.severity]}>{ch.severity==="major"?"MAJOR":ch.severity==="notable"?"NOTABLE":"INFO"}</span><span className="chBody">{name&&<b className="chBrand">{name}</b>}<span className="chTitle">{ch.title}</span>{ch.detail&&<span className="chDetail">{ch.detail}</span>}</span><time>{new Date(ch.detected_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></>;
 return onOpen?<button className={"chItem"+(unread?" unread":"")} onClick={onOpen}>{inner}</button>:<div className={"chItem"+(unread?" unread":"")}>{inner}</div>;
}

export default function Watchlist({data,cases,onOpen,onToggle,onChecked,onSeen}:{data:WatchData|null;cases:Case[];onOpen:(id:string)=>void;onToggle:(id:string,on:boolean)=>void;onChecked:()=>void;onSeen:()=>void}){
 const [busy,setBusy]=useState("");const [msg,setMsg]=useState("");
 useEffect(()=>{if(data?.unread){const t=setTimeout(onSeen,2500);return()=>clearTimeout(t)}},[data?.unread,onSeen]);
 if(!data)return <div className="portfolio"><p className="pfEmpty"><Loader2 size={16} className="spin"/> Loading your watchlist…</p></div>;
 const byId=new Map(cases.map(c=>[c.id,c]));const seen=data.seenAt?new Date(data.seenAt).getTime():0;
 const check=async(id:string)=>{setBusy(id);setMsg("");const r=await fetch("/api/watchlist/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId:id})});const d=await r.json().catch(()=>({}));
  setMsg(r.ok?(d.changes?.length?`${byId.get(id)?.name}: ${d.changes.length} change${d.changes.length>1?"s":""} found.`:`${byId.get(id)?.name}: no changes since the last check.`):(d.error||"Check failed."));setBusy("");onChecked()};
 return <div className="portfolio">
  <div className="pfHead"><div><div className="pfKicker">WATCHLIST</div><h1>{data.items.length?`Watching ${data.items.length} brand${data.items.length>1?"s":""}`:"Your watchlist is empty"}</h1>
   <p>{data.weeklyScheduled?"Starred brands are re-checked every week for new landing pages and presells, persona pages, big swings in ads or traffic, and new links to other brands.":"Weekly automatic checks switch on once CRON_SECRET is added in Vercel — until then use Check now."} Only you see your watchlist.</p></div></div>
  {msg&&<div className="notice"><span>{msg}</span><button onClick={()=>setMsg("")} aria-label="Dismiss">×</button></div>}
  {!data.items.length?<p className="pfEmpty">Star a brand from its case file or its card in Case files to start watching it.</p>:<>
   <section className="chFeed"><h2>What changed</h2>{data.changes.length?data.changes.slice(0,60).map(ch=><ChangeItem key={ch.id} ch={ch} name={byId.get(ch.investigation_id)?.name} unread={new Date(ch.detected_at).getTime()>seen} onOpen={()=>onOpen(ch.investigation_id)}/>):<p className="dim">No changes recorded yet. The first check compares each brand against what&apos;s already on file.</p>}</section>
   <section className="watchList"><h2>Watched brands</h2>{data.items.map(it=>{const c=byId.get(it.investigation_id);const n=data.changes.filter(x=>x.investigation_id===it.investigation_id).length;
    return <div key={it.investigation_id} className="watchRow">
     <div className="watchMain"><button className="watchName" onClick={()=>onOpen(it.investigation_id)}>{c?.name||it.investigation_id}</button><span>{c?.domain?<SiteLink domain={c.domain}/>:null}{c?.metrics?.monthlyVisits!=null?` · ${compact(c.metrics.monthlyVisits)} visits/mo`:""}</span></div>
     <span className="watchMeta">{it.lastChecked?`checked ${ago(it.lastChecked)}`:"not checked yet"}<br/>{n} change{n===1?"":"s"}</span>
     <button className="watchBtn" disabled={busy===it.investigation_id} onClick={()=>check(it.investigation_id)}>{busy===it.investigation_id?<Loader2 size={14} className="spin"/>:<RefreshCw size={14}/>} Check now</button>
     <button className="watchBtn ghost" onClick={()=>onToggle(it.investigation_id,false)} aria-label={`Stop watching ${c?.name||""}`}><StarOff size={14}/> Unwatch</button>
    </div>})}</section>
  </>}
 </div>;
}

export function StarButton({on,onClick,compactMode}:{on:boolean;onClick:()=>void;compactMode?:boolean}){
 return <button className={"starBtn"+(on?" on":"")+(compactMode?" mini":"")} aria-pressed={on} aria-label={on?"Stop watching this brand":"Watch this brand"} title={on?"Watching — click to stop":"Watch this brand"} onClick={e=>{e.stopPropagation();onClick()}}><Star size={compactMode?15:14} fill={on?"currentColor":"none"}/>{!compactMode&&(on?" Watching":" Watch")}</button>;
}
