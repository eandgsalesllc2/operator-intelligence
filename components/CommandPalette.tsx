"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Search,Sparkles,Loader2,FileText,Fingerprint,UserRound,History,X} from "lucide-react";

// ⌘K / Ctrl+K: search brands, people, companies and every indexed identifier (pixels, Shopify stores, phones,
// emails, trademark serials…) across all case files; Enter opens the case, or starts research on the text.
type Hit={group:"brand"|"identifier"|"entity";label:string;detail:string;caseId:string;caseName:string};
type Row={kind:"research"|"hit"|"recent";hit?:Hit;text?:string;recent?:Recent};
const GROUP={brand:{title:"Case files",I:FileText},entity:{title:"People, companies & trademarks",I:UserRound},identifier:{title:"Identifiers",I:Fingerprint}};

// Recent searches, newest first, kept in this browser. Each remembers what it led to so the list reads as history.
type Recent={q:string;opened?:string;at:number};
const RECENT_KEY="bt:recentSearches",MAX_RECENT=12;
const readRecent=():Recent[]=>{try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");return Array.isArray(v)?v.filter(x=>x&&typeof x.q==="string"):[]}catch{return []}};
const writeRecent=(v:Recent[])=>{try{localStorage.setItem(RECENT_KEY,JSON.stringify(v))}catch{}};
const ago=(t:number)=>{const m=Math.round((Date.now()-t)/60000);return m<1?"just now":m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`};

export default function CommandPalette({initial,local,onOpenCase,onResearch,onClose}:{initial:string;local:(q:string)=>Hit[];onOpenCase:(id:string)=>void;onResearch:(q:string)=>void;onClose:()=>void}){
 const [q,setQ]=useState(initial);const [hits,setHits]=useState<Hit[]>([]);const [busy,setBusy]=useState(false);const [i,setI]=useState(0);const [recent,setRecent]=useState<Recent[]>([]);
 useEffect(()=>{setRecent(readRecent())},[]);
 const saveRecent=(text:string,opened?:string)=>{const t=text.trim();if(t.length<2)return;const next=[{q:t,opened,at:Date.now()},...readRecent().filter(r=>r.q.toLowerCase()!==t.toLowerCase())].slice(0,MAX_RECENT);writeRecent(next);setRecent(next)};
 const forget=(text:string)=>{const next=readRecent().filter(r=>r.q!==text);writeRecent(next);setRecent(next);input.current?.focus()};
 const clearRecent=()=>{writeRecent([]);setRecent([]);input.current?.focus()};
 const input=useRef<HTMLInputElement>(null);const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{input.current?.focus();input.current?.select()},[]);
 useEffect(()=>{
  const t=q.trim();if(t.length<2){setHits([]);return}
  setBusy(true);const ctl=new AbortController();
  const timer=setTimeout(()=>{fetch("/api/search?q="+encodeURIComponent(t),{signal:ctl.signal}).then(r=>r.json()).then(d=>setHits(d.hits||[])).catch(()=>{}).finally(()=>setBusy(false))},180);
  return()=>{clearTimeout(timer);ctl.abort()};
 },[q]);
 const rows=useMemo<Row[]>(()=>{
  const t=q.trim();if(t.length<2)return recent.map(r=>({kind:"recent" as const,recent:r}));
  const merged=[...local(t),...hits];const seen=new Set<string>();const uniq=merged.filter(h=>{const k=h.group+h.label.toLowerCase()+h.caseId;if(seen.has(k))return false;seen.add(k);return true});
  const order=["brand","entity","identifier"] as const;
  return [{kind:"research",text:t},...order.flatMap(g=>uniq.filter(h=>h.group===g).slice(0,g==="brand"?8:14).map(h=>({kind:"hit" as const,hit:h})))];
 },[q,hits,local,recent]);
 useEffect(()=>{setI(q.trim().length>=2&&rows.length>1?1:0)},[rows.length,q]);
 useEffect(()=>{list.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({block:"nearest"})},[i]);
 const choose=(r?:Row)=>{if(!r)return;
  if(r.kind==="recent"){setQ(r.recent!.q);input.current?.focus();return} // run that search again
  if(r.kind==="research"){saveRecent(r.text!,"Researched");onResearch(r.text!)}else{saveRecent(q,r.hit!.caseName);onOpenCase(r.hit!.caseId)}
  onClose()};
 const key=(e:React.KeyboardEvent)=>{
  if(e.key==="Escape"){e.preventDefault();onClose()}
  else if(e.key==="ArrowDown"){e.preventDefault();setI(x=>Math.min(rows.length-1,x+1))}
  else if(e.key==="ArrowUp"){e.preventDefault();setI(x=>Math.max(0,x-1))}
  else if(e.key==="Enter"){e.preventDefault();choose(rows[i])}
 };
 let lastGroup="";
 return <div className="cmdBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="cmd" role="dialog" aria-modal="true" aria-label="Search everything">
   <div className="cmdInput"><Search size={17}/><input ref={input} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={key} placeholder="Trace a brand, person, company, pixel ID, phone, email, trademark…" aria-label="Search everything" aria-controls="cmdList" aria-activedescendant={rows.length?`cmd-${i}`:undefined}/>{busy&&<Loader2 size={15} className="spin"/>}<kbd>esc</kbd></div>
   <div className="cmdList" id="cmdList" role="listbox" ref={list}>
    {q.trim().length<2&&!recent.length&&<p className="cmdHint">Type at least 2 characters. Try a Meta pixel ID, a GTM container, a phone number, a person or a company — BrandTracer finds every case that uses it.</p>}
    {q.trim().length<2&&recent.length>0&&<div className="cmdGroup cmdRecentHead"><span>Recent searches</span><button onClick={clearRecent}>Clear</button></div>}
    {q.trim().length<2?rows.map((r,n)=><div key={r.recent!.q} className="cmdRecent"><button id={`cmd-${n}`} data-i={n} role="option" aria-selected={n===i} className={"cmdRow"+(n===i?" on":"")} onMouseEnter={()=>setI(n)} onClick={()=>choose(r)}>
      <History size={15}/><span><b>{r.recent!.q}</b><small>{r.recent!.opened?`${r.recent!.opened==="Researched"?"Researched":`Opened ${r.recent!.opened}`} · `:""}{ago(r.recent!.at)}</small></span></button>
      <button className="cmdForget" onClick={()=>forget(r.recent!.q)} aria-label={`Remove “${r.recent!.q}” from recent searches`} title="Remove"><X size={13}/></button></div>):
     rows.map((r,n)=>{const head=r.kind==="hit"&&r.hit!.group!==lastGroup?(lastGroup=r.hit!.group,<div key={"h"+n} className="cmdGroup">{GROUP[r.hit!.group].title}</div>):null;
      const G=r.kind==="hit"?GROUP[r.hit!.group].I:Sparkles;
      return [head,<button key={n} id={`cmd-${n}`} data-i={n} role="option" aria-selected={n===i} className={"cmdRow"+(n===i?" on":"")} onMouseEnter={()=>setI(n)} onClick={()=>choose(r)}>
       <G size={15}/>{r.kind==="research"?<span><b>Research “{r.text}”</b><small>Start a new case — BrandTracer checks the site, registries, ads and the web</small></span>
       :<span><b>{r.hit!.label}</b><small>{r.hit!.group==="brand"?r.hit!.detail:`${r.hit!.detail} · in ${r.hit!.caseName}`}</small></span>}</button>]})}
    {q.trim().length>=2&&!busy&&rows.length===1&&<p className="cmdHint">Nothing in your case files matches yet — research it to start a new case.</p>}
   </div>
   <div className="cmdFoot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
  </div>
 </div>;
}
