"use client";
import {useEffect,useState} from "react";
import {Loader2} from "lucide-react";
import {KIND_LABEL} from "@/lib/profile";
import {compact} from "@/lib/metrics";
import type {NetworkCluster} from "@/lib/repository";

// Clusters of brands that share hard identifiers (companies, people, phones, tracking IDs, trademark serials,
// funnel hosts) or a named parent network — each drawn as its own pin board.
const LABEL=(k:string)=>k==="network"?"same parent":(KIND_LABEL[k]||k).toLowerCase();
const HARDISH=new Set(["network","company","person","trademark_serial","phone","email","shopify_store","gtm","google_analytics","meta_pixel","tiktok_pixel","klaviyo","clarity","google_ads","checkout_account","payment_id","amazon_seller","card_descriptor","shopify_shop_id"]);

function Board({c,onOpen}:{c:NetworkCluster;onOpen:(id:string)=>void}){
 const n=c.members.length;const W=720,CW=156,CH=50;
 const rx=n<=2?210:Math.min(270,120+n*18),ry=n<=2?0:Math.min(150,70+n*10);const H=Math.max(200,ry*2+CH+70);
 const pos=new Map(c.members.map((m,i)=>{const a=n<=2?Math.PI*i:(-Math.PI/2)+(2*Math.PI*i)/n;return [m.id,{x:W/2+rx*Math.cos(a),y:H/2+ry*Math.sin(a)}]}));
 const tilt=(id:string)=>{let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))|0;return ((h%5)+5)%5-2};
 return <svg viewBox={`0 0 ${W} ${H}`} className="nwSvg" role="img" aria-label={`${n} linked brands: ${c.members.map(m=>m.name).join(", ")}`}>
  {c.links.map((l,i)=>{const a=pos.get(l.a)!,b=pos.get(l.b)!;const hard=l.shared.some(s=>HARDISH.has(s.kind));const kinds=[...new Set(l.shared.map(s=>LABEL(s.kind)))];
   return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hard?"#c2412d":"#e0a93f"} strokeWidth={hard?2.4:1.6} strokeDasharray={hard?undefined:"6 5"} opacity=".9"/>
    <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-6} className="nwLabel">{kinds.slice(0,3).join(" · ")}{kinds.length>3?" …":""}</text></g>})}
  {c.members.map(m=>{const p=pos.get(m.id)!;return <g key={m.id} className="nwCard" transform={`translate(${p.x-CW/2},${p.y-CH/2}) rotate(${tilt(m.id)} ${CW/2} ${CH/2})`} tabIndex={0} role="button" aria-label={`Open ${m.name}`} onClick={()=>onOpen(m.id)} onKeyDown={e=>{if(e.key==="Enter")onOpen(m.id)}}>
   <rect x="3" y="4" width={CW} height={CH} rx="2" fill="#000" opacity=".35"/><rect className="card" width={CW} height={CH} rx="2" fill="#efe6d6"/>
   <circle cx={CW/2} cy="1" r="5" fill="#c2412d" stroke="#1d1a16"/>
   <text x="12" y="22" className="nwName">{m.name.length>20?m.name.slice(0,19)+"…":m.name}</text>
   <text x="12" y="38" className="nwSub">{m.visits!=null?`${compact(m.visits)} visits/mo`:m.domain.slice(0,24)}</text>
  </g>})}
 </svg>;
}

export default function Networks({onOpen}:{onOpen:(id:string)=>void}){
 const [data,setData]=useState<NetworkCluster[]|null>(null);const [err,setErr]=useState("");const [show,setShow]=useState<"hard"|"all">("hard");
 useEffect(()=>{fetch("/api/networks").then(r=>r.json()).then(d=>{if(d.error)setErr(d.error);else setData(d.clusters||[])}).catch(()=>setErr("Could not load networks."))},[]);
 if(err)return <div className="portfolio"><p className="pfEmpty">{err}</p></div>;
 if(!data)return <div className="portfolio"><p className="pfEmpty"><Loader2 size={16} className="spin"/> Tracing shared identifiers across every case…</p></div>;
 const list=show==="hard"?data.filter(c=>c.hard):data;const brands=new Set(list.flatMap(c=>c.members.map(m=>m.id))).size;
 return <div className="portfolio">
  <div className="pfHead"><div><div className="pfKicker">NETWORKS</div><h1>{list.length} operator networks · {brands} brands</h1><p>Brands pinned together share a company, person, phone, email, tracking ID, trademark serial, funnel host or named parent. Red string = hard identifier; dashed amber = softer overlap (domains, addresses, generic tracking). Shared vendors and registered agents are never counted.</p></div>
   <div className="pfChips" role="group" aria-label="Link strength"><button className={show==="hard"?"on":""} aria-pressed={show==="hard"} onClick={()=>setShow("hard")}>Hard links</button><button className={show==="all"?"on":""} aria-pressed={show==="all"} onClick={()=>setShow("all")}>All overlaps</button></div></div>
  {list.length?<div className="nwList">{list.map(c=><section key={c.id} className="nwBoard">
   <div className="nwHead"><h2>{c.label}</h2><span>{c.members.length} brands · {compact(c.visits)} visits/mo</span></div>
   <Board c={c} onOpen={onOpen}/>
   <details className="nwWhy"><summary>What links them</summary><ul>{c.links.map((l,i)=>{const a=c.members.find(m=>m.id===l.a)?.name,b=c.members.find(m=>m.id===l.b)?.name;return <li key={i}><b>{a}</b> ↔ <b>{b}</b>: {l.shared.slice(0,4).map(s=>`${LABEL(s.kind)} “${s.value}”`).join("; ")}{l.shared.length>4?` +${l.shared.length-4} more`:""}</li>})}</ul><p>Shared identifiers are a strong operator signal but not proof of ownership on their own — confirm with registry or trademark records.</p></details>
  </section>)}</div>:<p className="pfEmpty">No linked brands yet.</p>}
 </div>;
}
