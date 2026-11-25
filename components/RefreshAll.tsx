"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {RefreshCw,Square,Loader2} from "lucide-react";

// One click re-checks every brand (BrandSearch traffic + Atria landing pages, no AI web research), stalest first,
// a few at a time through /api/watchlist/check. Runs in this tab; progress is remembered so a closed tab can resume.
type Run={startedAt:number;ids:string[];done:string[];failed:string[];skipped:string[];noLanding?:string[];sourceError?:string};
const KEY="bt:refreshRun",AT_ONCE=1; // one at a time: Atria rate-limits per workspace
const load=():Run|null=>{try{const r=JSON.parse(localStorage.getItem(KEY)||"null");return r&&Array.isArray(r.ids)?r:null}catch{return null}};
const save=(r:Run|null)=>{try{r?localStorage.setItem(KEY,JSON.stringify(r)):localStorage.removeItem(KEY)}catch{}};
const mins=(ms:number)=>ms<90e3?"under 2 min":`~${Math.round(ms/60e3)} min`;

export default function RefreshAll({cases,onFinished}:{cases:{id:string;name:string;domain:string;updatedAt?:string}[];onFinished:()=>void}){
 const [run,setRun]=useState<Run|null>(null),[busy,setBusy]=useState(false),[eta,setEta]=useState<number|null>(null);
 const stop=useRef(false);
 useEffect(()=>{const r=load();if(r&&r.done.length+r.failed.length+r.skipped.length<r.ids.length)setRun(r);else save(null)},[]);
 useEffect(()=>{if(!busy)return;const w=(e:BeforeUnloadEvent)=>{e.preventDefault()};window.addEventListener("beforeunload",w);return()=>window.removeEventListener("beforeunload",w)},[busy]);

 const go=useCallback(async(resume:Run|null)=>{
  const ids=resume?.ids||[...cases].filter(c=>c.domain).sort((a,b)=>(a.updatedAt||"").localeCompare(b.updatedAt||"")).map(c=>c.id);
  if(!ids.length)return;
  if(!resume&&!window.confirm(`Refresh all ${ids.length} brands? This pulls fresh traffic, ads and landing pages from BrandSearch and Atria for every brand (no AI research) and takes about ${mins(ids.length*9000/AT_ONCE)}. Keep this tab open while it runs.`))return;
  const r:Run=resume||{startedAt:Date.now(),ids,done:[],failed:[],skipped:[]};
  const left=r.ids.filter(id=>!r.done.includes(id)&&!r.failed.includes(id)&&!r.skipped.includes(id));
  stop.current=false;setBusy(true);setRun({...r});save(r);
  const t0=Date.now();let n=0,i=0;
  await Promise.all(Array.from({length:AT_ONCE},async()=>{while(i<left.length&&!stop.current){const id=left[i++];
   let res:Response|null=null;
   for(let a=0;a<2&&!(res&&(res.ok||res.status===429||res.status===404));a++)res=await fetch("/api/watchlist/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId:id})}).catch(()=>null);
   (res?.ok?r.done:res?.status===429?r.skipped:r.failed).push(id); // 429 = already refreshed in the last hour
   if(res?.ok){const b=await res.clone().json().catch(()=>null);const at=b?.sources?.find((x:any)=>x.source==="atria");
    if(at&&!at.ok){(r.noLanding||=[]).push(id);if(/API errors|failed|not configured/i.test(at.note||""))r.sourceError=at.note}}
   n++;setEta((Date.now()-t0)/n*(left.length-n));setRun({...r});save(r);
  }}));
  setBusy(false);setEta(null);
  const finished=r.done.length+r.failed.length+r.skipped.length>=r.ids.length;
  if(finished){save(null);setRun({...r})}
  onFinished();
 },[cases,onFinished]);

 const total=run?.ids.length||0,processed=run?run.done.length+run.failed.length+run.skipped.length:0;
 const finished=!!run&&!busy&&processed>=total;
 return <div className="refreshAll">
  {!busy&&<button className="raBtn" onClick={()=>go(!finished&&run?run:null)} title="Pull fresh traffic, ads and landing pages for every brand">
   <RefreshCw size={14}/>{run&&!finished?`Resume refresh · ${total-processed} left`:`Refresh all ${cases.filter(c=>c.domain).length}`}</button>}
  {run&&(busy||!finished||processed>0)&&<div className="raBar" role="status" aria-live="polite">
   <div className="raTrack"><i style={{width:`${total?Math.round(processed/total*100):0}%`}}/></div>
   <span>{busy?<Loader2 size={13} className="spin"/>:null}
    {busy?`Refreshing ${processed} of ${total}`:finished?`Refreshed ${run.done.length} of ${total}`:`Stopped at ${processed} of ${total}`}
    {run.skipped.length?` · ${run.skipped.length} already fresh`:""}{run.failed.length?` · ${run.failed.length} failed`:""}
    {busy&&eta!=null&&processed>2?` · ${mins(eta)} left`:""}
    {run.noLanding?.length?` · no fresh landing pages for ${run.noLanding.length}`:""}</span>
   {busy?<button className="raStop" onClick={()=>{stop.current=true}}><Square size={11}/> Stop</button>
    :finished?<button className="raStop" onClick={()=>setRun(null)}>Dismiss</button>:null}
  </div>}
  {run?.sourceError&&<p className="raErr" title={run.sourceError}>Atria problem: {run.sourceError.slice(0,180)}</p>}
 </div>;
}
