"use client";
import {useEffect,useMemo,useState} from "react";
import {Loader2,Play,ExternalLink,Image as ImageIcon} from "lucide-react";

// The brand's live ad creatives as a visual wall — fetched on demand from Atria (or BrandSearch).
type Creative={id:string;image:string|null;video:string|null;format:string;title:string|null;body:string;cta:string|null;page:string|null;days:number|null;started:string|null;landing:string|null;source:string};

function Card({a}:{a:Creative}){
 const [play,setPlay]=useState(false);const [broken,setBroken]=useState(false);
 let lp="";try{if(a.landing){const u=new URL(a.landing);lp=u.hostname.replace(/^www\./,"")+(u.pathname.length>1?u.pathname:"")}}catch{}
 return <article className="wallCard">
  <div className="wallMedia">
   {play&&a.video?<video src={a.video} controls autoPlay playsInline preload="none"/>
   :a.image&&!broken?<img src={a.image} alt={a.title||a.body.slice(0,80)||"Ad creative"} loading="lazy" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>
   :<div className="wallNoImg"><ImageIcon size={22}/><span>{a.video?"Video ad":"No preview"}</span></div>}
   {a.video&&!play&&<button className="wallPlay" onClick={()=>setPlay(true)} aria-label="Play video"><Play size={22}/></button>}
   {a.days!=null&&<span className="wallDays">{a.days}d live</span>}
  </div>
  <div className="wallBody">
   <div className="wallMeta"><span className="wallPage">{a.page||"—"}</span>{a.cta&&<span className="wallCta">{a.cta.replace(/_/g," ").toLowerCase()}</span>}</div>
   {a.title&&<b>{a.title}</b>}
   {a.body&&<p>{a.body}</p>}
   {lp&&<a href={a.landing!} target="_blank" rel="noopener noreferrer nofollow" className="wallLp"><ExternalLink size={12}/> {lp.length>48?lp.slice(0,47)+"…":lp}</a>}
  </div>
 </article>;
}

export default function AdWall({investigationId}:{investigationId:string}){
 const [data,setData]=useState<{creatives:Creative[];source:string;note?:string}|null>(null);const [err,setErr]=useState("");const [fmt,setFmt]=useState<"all"|"video"|"image">("all");const [sort,setSort]=useState<"top"|"longest"|"newest">("top");
 useEffect(()=>{setData(null);setErr("");fetch("/api/creatives?investigationId="+encodeURIComponent(investigationId)).then(r=>r.json()).then(d=>d.error&&!d.creatives?.length?setErr(d.error):setData(d)).catch(()=>setErr("Could not load ad creatives."))},[investigationId]);
 const list=useMemo(()=>{const xs=(data?.creatives||[]).filter(a=>fmt==="all"||(fmt==="video"?!!a.video||a.format==="video":!a.video&&a.format!=="video"));
  if(sort==="longest")return [...xs].sort((a,b)=>(b.days||0)-(a.days||0));if(sort==="newest")return [...xs].sort((a,b)=>String(b.started||"").localeCompare(String(a.started||"")));return xs},[data,fmt,sort]);
 return <section className="psec wall">
  <div className="wallHead"><h4>Ad wall · live creatives</h4>
   {data&&data.creatives.length>0&&<div className="wallControls">
    <div className="pfChips" role="group" aria-label="Format">{(["all","video","image"] as const).map(f=><button key={f} className={fmt===f?"on":""} aria-pressed={fmt===f} onClick={()=>setFmt(f)}>{f==="all"?"All":f==="video"?"Video":"Image"}</button>)}</div>
    <label className="pfSort">Sort<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="top">Top impressions</option><option value="longest">Longest running</option><option value="newest">Newest</option></select></label>
   </div>}
  </div>
  {err?<p className="dim">{err}</p>:!data?<p className="dim"><Loader2 size={14} className="spin"/> Pulling live creatives…</p>
  :data.creatives.length?<><div className="wallGrid">{list.map(a=><Card key={a.id} a={a}/>)}</div><p className="dim small">{data.creatives.length} active ads from the {data.source}, ranked by impressions. Media is loaded live from the ad library.</p></>
  :<p className="dim">{data.note||"No active creatives found."}</p>}
 </section>;
}
