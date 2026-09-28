"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Search,Sparkles,Loader2,FileText,Fingerprint,UserRound} from "lucide-react";

// ⌘K / Ctrl+K: search brands, people, companies and every indexed identifier (pixels, Shopify stores, phones,
// emails, trademark serials…) across all case files; Enter opens the case, or starts research on the text.
type Hit={group:"brand"|"identifier"|"entity";label:string;detail:string;caseId:string;caseName:string};
type Row={kind:"research"|"hit";hit?:Hit;text?:string};
const GROUP={brand:{title:"Case files",I:FileText},entity:{title:"People, companies & trademarks",I:UserRound},identifier:{title:"Identifiers",I:Fingerprint}};

export default function CommandPalette({initial,local,onOpenCase,onResearch,onClose}:{initial:string;local:(q:string)=>Hit[];onOpenCase:(id:string)=>void;onResearch:(q:string)=>void;onClose:()=>void}){
 const [q,setQ]=useState(initial);const [hits,setHits]=useState<Hit[]>([]);const [busy,setBusy]=useState(false);const [i,setI]=useState(0);
 const input=useRef<HTMLInputElement>(null);const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{input.current?.focus();input.current?.select()},[]);
 useEffect(()=>{
  const t=q.trim();if(t.length<2){setHits([]);return}
  setBusy(true);const ctl=new AbortController();
  const timer=setTimeout(()=>{fetch("/api/search?q="+encodeURIComponent(t),{signal:ctl.signal}).then(r=>r.json()).then(d=>setHits(d.hits||[])).catch(()=>{}).finally(()=>setBusy(false))},180);
  return()=>{clearTimeout(timer);ctl.abort()};
 },[q]);
 const rows=useMemo<Row[]>(()=>{
  const t=q.trim();if(t.length<2)return [];
  const merged=[...local(t),...hits];const seen=new Set<string>();const uniq=merged.filter(h=>{const k=h.group+h.label.toLowerCase()+h.caseId;if(seen.has(k))return false;seen.add(k);return true});
  const order=["brand","entity","identifier"] as const;
  return [{kind:"research",text:t},...order.flatMap(g=>uniq.filter(h=>h.group===g).slice(0,g==="brand"?8:14).map(h=>({kind:"hit" as const,hit:h})))];
 },[q,hits,local]);
 useEffect(()=>{setI(rows.length>1?1:0)},[rows.length,q]);
 useEffect(()=>{list.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({block:"nearest"})},[i]);
 const choose=(r?:Row)=>{if(!r)return;if(r.kind==="research")onResearch(r.text!);else onOpenCase(r.hit!.caseId);onClose()};
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
    {q.trim().length<2?<p className="cmdHint">Type at least 2 characters. Try a Meta pixel ID, a GTM container, a phone number, a person or a company — BrandTracer finds every case that uses it.</p>:
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
