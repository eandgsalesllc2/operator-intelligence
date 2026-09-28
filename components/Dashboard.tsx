"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Search,Network,ShieldCheck,FileText,Clock3,Plus,ChevronRight,ChevronDown,Building2,UserRound,Globe2,Tags,MapPin,X,Menu,Mail,Phone,Loader2,AlertTriangle,CheckCircle2,Sparkles,Fingerprint,Megaphone,Play} from "lucide-react";
import {cases} from "@/lib/data"; import {Case,Confidence,Edge,IntelNode,NodeType} from "@/lib/types";
import {addEvidence,createInvestigation,loadCases,pivotNode,saveCases} from "@/lib/store";
import {CATEGORIES,UNCATEGORIZED,labelOf,verticalOf} from "@/lib/categories";
import {MRR_METHOD,REVENUE_METHOD,compact,currencySymbol} from "@/lib/metrics";
import ProfilePanel from "./ProfilePanel";
import CaseHero from "./CaseHero";
import Portfolio from "./Portfolio";
import Networks from "./Networks";
import CommandPalette from "./CommandPalette";
import Watchlist,{StarButton,type WatchData} from "./Watchlist";
import Demo,{type DemoAction} from "./Demo";
import SiteLink,{siteHost} from "./SiteLink";
import MarketingPanel from "./MarketingPanel";
import Onboarding from "./Onboarding";
import AccountMenu,{type Me} from "./AccountMenu";

// Confidence colours tuned for the case-file palette; they differ in lightness as well as hue.
const cc:Record<Confidence,string>={confirmed:"#4fbf87",strong:"#7ea6d8",correlation:"#e0a93f",lead:"#a39884",excluded:"#e0675a"};
// Small, stable tilt per card so the pin board looks hand-pinned.
const tilt=(id:string)=>{let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))|0;return ((h%5)+5)%5-2};
const icons:Record<NodeType,any>={brand:Globe2,person:UserRound,company:Building2,trademark:Tags,domain:Globe2,address:MapPin,phone:Phone,email:Mail};
const TYPES:{value:NodeType;label:string}[]=[{value:"brand",label:"Brand"},{value:"domain",label:"Domain / website"},{value:"person",label:"Person"},{value:"company",label:"Company / LLC"},{value:"trademark",label:"Trademark"},{value:"email",label:"Email"},{value:"phone",label:"Phone"},{value:"address",label:"Address"}];
type Job={id:string;investigation_id:string;status:"queued"|"running"|"completed"|"failed";progress:number;message:string;seed_value:string};

function guessType(v:string):NodeType{
 const s=v.trim();
 if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s))return "email";
 if(/^\+?[\d\s().-]{10,}$/.test(s))return "phone";
 if(/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(s))return "domain";
 if(/\b(LLC|Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|GmbH|B\.V\.|PBC|LLP|UAB|Holdings?)\b/i.test(s))return "company";
 if(/^\d+\s+\w+/.test(s))return "address";
 return "brand";
}
const isUrl=(s:string)=>/^https?:\/\//.test(s);

function Badge({c}:{c:Confidence}){return <span className="badge" style={{color:cc[c],borderColor:cc[c]+"55",background:cc[c]+"12"}}><i style={{background:cc[c]}}/>{c}</span>}

function Graph({nodes,edges,onPick}:{nodes:IntelNode[],edges:Edge[],onPick:(n:IntelNode)=>void}){
 const by=Object.fromEntries(nodes.map(n=>[n.id,n]));
 const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
 const minX=Math.min(0,...xs)-20,minY=Math.min(0,...ys)-20,maxX=Math.max(900,...xs.map(x=>x+165)),maxY=Math.max(510,...ys.map(y=>y+75));
 const w=maxX-minX,h=maxY-minY;
 return <div className="graph" style={{"--ratio":`${w}/${h}`} as any}><svg viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Relationship graph">
 <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#8a7f6c"/></marker></defs>
 {edges.map((e,i)=>{const a=by[e.from],b=by[e.to];if(!a||!b)return null;return <g key={i}><line x1={a.x+72} y1={a.y+27} x2={b.x+72} y2={b.y+27} stroke={cc[e.confidence]} strokeOpacity=".85" strokeWidth={e.confidence==="confirmed"||e.confidence==="strong"?2.2:1.6} strokeDasharray={e.confidence==="correlation"||e.confidence==="lead"?"5 4":undefined} markerEnd="url(#arrow)"/><text x={(a.x+b.x)/2+72} y={(a.y+b.y)/2+22} className="edgeLabel">{e.label}</text></g>})}
 {nodes.map(n=>{const I=icons[n.type]||Globe2;return <g key={n.id} onClick={()=>onPick(n)} className="node" transform={`translate(${n.x},${n.y}) rotate(${tilt(n.id)} 72 27)`} tabIndex={0} role="button" aria-label={`${n.label}, ${n.type}, ${n.confidence}`} onKeyDown={e=>{if(e.key==="Enter")onPick(n)}}><rect x="2" y="3" width="145" height="55" rx="2" fill="#000" opacity=".35"/><rect className="card" width="145" height="55" rx="2" fill={n.confidence==="lead"||n.confidence==="excluded"?"#d9cbb2":"#efe6d6"}/><circle cx="20" cy="27" r="12" fill={cc[n.confidence]+"33"}/><foreignObject x="12" y="19" width="16" height="16"><I size={16} color="#3a3228"/></foreignObject><circle cx="72" cy="1" r="4.5" fill={cc[n.confidence]} stroke="#1d1a16" strokeWidth="1"/><text x="39" y="23" className="nodeTitle">{n.label.length>18?n.label.slice(0,18)+"…":n.label}</text><text x="39" y="39" className="nodeSub">{n.subtitle.length>22?n.subtitle.slice(0,22)+"…":n.subtitle}</text></g>})}</svg></div>;
}

export default function Dashboard(){
 const [allCases,setAllCases]=useState<Case[]>(cases),[caseId,setCaseId]=useState("ultimapeak"),[tab,setTab]=useState("graph"),[pick,setPick]=useState<IntelNode|null>(null);
 const [q,setQ]=useState(""),[sq,setSq]=useState(""),[cat,setCat]=useState("all"),[flag,setFlag]=useState("all"),[fullIds,setFullIds]=useState<Set<string>>(new Set()),[navOpen,setNavOpen]=useState(false),[openGroups,setOpenGroups]=useState<Set<string>>(new Set());
 const [newOpen,setNewOpen]=useState(false),[newSeed,setNewSeed]=useState({value:"",type:"auto",name:""}),[pivotOpen,setPivotOpen]=useState(false),[evidenceOpen,setEvidenceOpen]=useState(false);
 const [db,setDb]=useState(false),[webResearch,setWebResearch]=useState<boolean|null>(null),[loading,setLoading]=useState(true);
 const [jobs,setJobs]=useState<Record<string,Job>>({}),[notice,setNotice]=useState("");
 const polls=useRef<Record<string,number>>({});
 const [me,setMe]=useState<Me|null>(null),[tour,setTour]=useState(false),[view,setView]=useState<"portfolio"|"networks"|"watchlist"|"case">("portfolio"),[cmd,setCmd]=useState<string|null>(null),[demo,setDemo]=useState(false);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCmd(c=>c===null?"":null)}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[]);
 // ---- URL <-> view: "/" case files, "/networks", "/case/<id>?tab=…" (shareable, Back/Forward work) ----
 const TABS=["graph","evidence","timeline","profile","marketing"];
 const [watch,setWatch]=useState<WatchData|null>(null);
 const loadWatch=useCallback(()=>{const empty={items:[],changes:[],unread:0,seenAt:null,weeklyScheduled:false};return fetch("/api/watchlist",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>setWatch(d&&!d.error?d:w=>w||empty)).catch(()=>setWatch(w=>w||empty))},[]);
 useEffect(()=>{loadWatch()},[loadWatch]);
 const watched=useMemo(()=>new Set((watch?.items||[]).map(i=>i.investigation_id)),[watch]);
 const toggleWatch=useCallback(async(id:string,on:boolean)=>{
  setWatch(w=>w?{...w,items:on?[{investigation_id:id,created_at:new Date().toISOString(),lastChecked:null},...w.items.filter(i=>i.investigation_id!==id)]:w.items.filter(i=>i.investigation_id!==id)}:w);
  const r=await fetch("/api/watchlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId:id,watch:on})});
  if(!r.ok)setNotice("Couldn't update your watchlist.");loadWatch();
 },[loadWatch]);
 const markWatchSeen=useCallback(()=>{fetch("/api/watchlist/seen",{method:"POST"}).then(()=>setWatch(w=>w?{...w,unread:0,seenAt:new Date().toISOString()}:w)).catch(()=>{})},[]);
 const fromUrl=useRef(false);
 const applyUrl=useCallback(()=>{
  const {pathname,search}=window.location;const m=/^\/case\/([^/]+)/.exec(pathname);const t=new URLSearchParams(search).get("tab");
  fromUrl.current=true;
  if(m){setCaseId(decodeURIComponent(m[1]));setView("case");setTab(t&&TABS.includes(t)?t:"graph")}
  else if(pathname.startsWith("/networks"))setView("networks");
  else if(pathname.startsWith("/watchlist"))setView("watchlist");
  else setView("portfolio");
  setPick(null);
  setTimeout(()=>{fromUrl.current=false},0); // if nothing changed, don't swallow the next real navigation
 },[]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{applyUrl();const on=()=>applyUrl();window.addEventListener("popstate",on);return()=>window.removeEventListener("popstate",on)},[applyUrl]);
 const urlReady=useRef(false);
 useEffect(()=>{
  const want=view==="case"?`/case/${encodeURIComponent(caseId)}${tab!=="graph"?`?tab=${tab}`:""}`:view==="networks"?"/networks":view==="watchlist"?"/watchlist":"/";
  if(!urlReady.current){urlReady.current=true;return} // first render still holds defaults; the URL is the source of truth
  if(fromUrl.current){fromUrl.current=false;return}   // state came from the URL (load or Back/Forward): don't write it back
  const now=window.location.pathname+window.location.search;
  if(now!==want)window.history.pushState(null,"",want);
 },[view,caseId,tab]);
 useEffect(()=>{const x=allCases.find(y=>y.id===caseId);document.title=view==="case"&&x?`${x.name} · BrandTracer`:view==="networks"?"Networks · BrandTracer":view==="watchlist"?"Watchlist · BrandTracer":"BrandTracer"},[view,caseId,allCases]);
 useEffect(()=>{
  if(new URLSearchParams(window.location.search).get("tour")==="1")setTour(true);
  fetch("/api/auth/me").then(r=>{if(r.status===401){window.location.href="/login";return null}return r.ok?r.json():null}).then(d=>{if(d?.user){setMe(d.user);if(!d.user.onboarded_at)setTour(true)}}).catch(()=>{});
 },[]);

 useEffect(()=>{
  const stored=loadCases();setAllCases(stored);
  fetch("/api/investigations").then(r=>r.json()).then(d=>{setDb(Boolean(d.database));if(d.database&&d.cases?.length){setAllCases(d.cases);setCaseId(prev=>d.cases.some((x:Case)=>x.id===prev)?prev:d.cases[0].id)}}).catch(()=>{}).finally(()=>setLoading(false));
  fetch("/api/research").then(r=>r.json()).then(d=>setWebResearch(Boolean(d.webResearch))).catch(()=>setWebResearch(false));
  const timers=polls.current;
  return ()=>Object.values(timers).forEach(t=>clearTimeout(t));
 },[]);
 useEffect(()=>{if(!db&&allCases.length){try{saveCases(allCases)}catch{}}},[allCases,db]);

 const c=allCases.find(x=>x.id===caseId)||allCases[0];
 const catCounts=useMemo(()=>{const m=new Map<string,number>();for(const x of allCases){const k=x.category||UNCATEGORIZED;m.set(k,(m.get(k)||0)+1)}return m},[allCases]);
 const verticals=useMemo(()=>{const m=new Map<string,string[]>();for(const k of catCounts.keys()){const v=verticalOf(k);if(!m.has(v))m.set(v,[]);m.get(v)!.push(k)}return [...m.entries()].sort((a,b)=>a[0]===UNCATEGORIZED?1:b[0]===UNCATEGORIZED?-1:a[0].localeCompare(b[0])).map(([v,ks])=>({v,ks:ks.sort(),n:ks.reduce((s,k)=>s+(catCounts.get(k)||0),0)}))},[catCounts]);
 // Networks shared by 2+ brands; a brand whose only "network" is itself doesn't count as being in one.
 const sharedNets=useMemo(()=>{const n=new Map<string,number>();for(const x of allCases)for(const t of x.tags||[])if(t.startsWith("network:"))n.set(t.toLowerCase(),(n.get(t.toLowerCase())||0)+1);return new Set([...n].filter(([,v])=>v>1).map(([k])=>k))},[allCases]);
 const sideCases=useMemo(()=>{const t=sq.trim().toLowerCase();return allCases.filter(x=>{const k=x.category||UNCATEGORIZED;if(cat!=="all"&&!(cat.startsWith("v:")?verticalOf(k)===cat.slice(2):k===cat))return false;if(flag==="network:*"){if(!(x.tags||[]).some(t=>sharedNets.has(t.toLowerCase())))return false}else if(flag!=="all"&&!(x.tags||[]).some(t=>flag.endsWith("*")?t.startsWith(flag.slice(0,-1)):t===flag))return false;return !t||(x.name+" "+x.domain+" "+k).toLowerCase().includes(t)})},[sq,cat,flag,allCases,sharedNets]);
 // Sidebar tree: vertical → category → investigations.
 const tree=useMemo(()=>{
  const vs=new Map<string,Map<string,Case[]>>();
  for(const x of sideCases){const k=x.category||UNCATEGORIZED;const v=verticalOf(k);if(!vs.has(v))vs.set(v,new Map());const m=vs.get(v)!;if(!m.has(k))m.set(k,[]);m.get(k)!.push(x)}
  // Biggest verticals first (Supplements, Beauty, ...); "Other" and uncategorized last.
  const last=(v:string)=>v===UNCATEGORIZED?2:v==="Other"?1:0;
  return [...vs.entries()].map(([v,m])=>({v,n:[...m.values()].reduce((s,l)=>s+l.length,0),cats:[...m.entries()].sort((a,b)=>b[1].length-a[1].length||labelOf(a[0]).localeCompare(labelOf(b[0]))).map(([k,l])=>({k,items:[...l].sort((a,b)=>(b.metrics?.monthlyVisits||0)-(a.metrics?.monthlyVisits||0)||a.name.localeCompare(b.name))}))})).sort((a,b)=>last(a.v)-last(b.v)||b.n-a.n||a.v.localeCompare(b.v));
 },[sideCases]);

 useEffect(()=>{const x=allCases.find(y=>y.id===caseId);if(!x)return;const k=x.category||UNCATEGORIZED;setOpenGroups(p=>p.has("v:"+verticalOf(k))&&p.has("c:"+k)?p:new Set([...p,"v:"+verticalOf(k),"c:"+k]))},[caseId,allCases]);
 const toggleGroup=(key:string)=>setOpenGroups(p=>{const n=new Set(p);n.has(key)?n.delete(key):n.add(key);return n});
 const refreshCase=useCallback(async(id:string)=>{
  const r=await fetch("/api/investigations?id="+encodeURIComponent(id),{cache:"no-store"});const d=await r.json();
  if(d.case)setAllCases(prev=>prev.some(x=>x.id===id)?prev.map(x=>x.id===id?d.case:x):[d.case,...prev]);
 },[]);

 useEffect(()=>{if(!db||!caseId||fullIds.has(caseId))return;setFullIds(p=>new Set([...p,caseId]));refreshCase(caseId)},[caseId,db,fullIds,refreshCase]);
 const poll=useCallback((job:Job)=>{
  const tick=async()=>{
   try{
    const r=await fetch("/api/research?jobId="+encodeURIComponent(job.id),{cache:"no-store"});const d=await r.json();
    if(d.job){setJobs(p=>({...p,[d.job.investigation_id]:d.job}));
     if(d.job.status==="completed"||d.job.status==="failed"){delete polls.current[job.id];await refreshCase(d.job.investigation_id);return}}
   }catch{}
   polls.current[job.id]=window.setTimeout(tick,3000);
  };
  polls.current[job.id]=window.setTimeout(tick,1500);
 },[refreshCase]);

 const startResearch=useCallback(async(input:{seedValue:string;seedType?:NodeType;name?:string;investigationId?:string;seedEntityId?:string})=>{
  setNotice("");
  const r=await fetch("/api/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const d=await r.json();
  if(!r.ok){setNotice(d.error||"Research could not start");return false}
  if(d.case){setAllCases(p=>[d.case,...p]);setCaseId(d.case.id);setPick(null);setTab("graph");setView("case")}
  setJobs(p=>({...p,[d.investigationId]:d.job}));
  poll(d.job);
  return true;
 },[poll]);

 if(!c)return null;
 const job=jobs[c.id];const busy=Boolean(job&&(job.status==="queued"||job.status==="running"));
 const sync=(next:Case)=>fetch("/api/investigations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)}).catch(()=>{});
 const updateCase=(next:Case)=>{setAllCases(prev=>prev.map(x=>x.id===next.id?next:x));sync(next)};
 const deleteCase=async(id:string,name:string)=>{if(!window.confirm(`Delete ${name}? This permanently removes the investigation and all collected research.`))return;const r=await fetch("/api/investigations",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const d=await r.json();if(!r.ok){setNotice(d.error||"Delete failed");return}setAllCases(prev=>{const next=prev.filter(x=>x.id!==id);if(id===caseId&&next[0])setCaseId(next[0].id);return next});setPick(null)};
 const openCase=(id:string)=>{setCaseId(id);setPick(null);setView("case");setNavOpen(false);if(typeof window!=="undefined")document.querySelector(".shell")?.scrollTo({top:0})};
 const submitNew=async(e:React.FormEvent)=>{
  e.preventDefault();const value=newSeed.value.trim();if(!value)return;
  const seedType=(newSeed.type==="auto"?guessType(value):newSeed.type) as NodeType;
  if(!db){const next=createInvestigation({name:newSeed.name||value,domain:seedType==="domain"?value:"",seedType,notes:""});setAllCases(p=>[next,...p]);setCaseId(next.id);setNewOpen(false);setNotice("The database isn't connected, so research can't run. The case was created in this browser only.");return}
  if(await startResearch({seedValue:value,seedType,name:newSeed.name||undefined})){setNewOpen(false);setNewSeed({value:"",type:"auto",name:""});setNavOpen(false)}
 };
 const openNew=(value="")=>{setNewSeed({value,type:"auto",name:""});setNewOpen(true);setQ("")};
 const researchCase=()=>{const seed=c.nodes.find(n=>n.id===c.id+":seed")||c.nodes.find(n=>n.type==="domain")||c.nodes.find(n=>n.type==="brand")||c.nodes[0];startResearch({investigationId:c.id,seedValue:c.domain||seed?.label||c.name,seedType:c.domain?"domain":seed?.type||"brand",seedEntityId:seed?.id})};
 const researchNode=(n:IntelNode)=>{startResearch({investigationId:c.id,seedValue:n.label,seedType:n.type,seedEntityId:n.id});setPick(null)};
 const createPivot=(fd:FormData)=>{if(!pick)return;const next=pivotNode(c,pick,String(fd.get("label")||"New lead"),String(fd.get("type")||"company") as NodeType,String(fd.get("note")||""));updateCase(next);setPivotOpen(false);setPick(next.nodes[next.nodes.length-1])};
 const createEvidenceItem=(fd:FormData)=>{updateCase(addEvidence(c,String(fd.get("title")||"Evidence"),String(fd.get("source")||"Manual source"),String(fd.get("note")||""),String(fd.get("confidence")||"lead") as Confidence));setEvidenceOpen(false);setTab("evidence")};
 const confirmed=c.nodes.filter(n=>n.confidence==="confirmed").length, strong=c.nodes.filter(n=>n.confidence==="strong").length;
 const timeline=[...c.timeline].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const guessed=newSeed.value.trim()?guessType(newSeed.value):null;
 const pickEdges=pick?c.edges.filter(e=>e.from===pick.id||e.to===pick.id):[];

 const renderCase=(x:Case)=>{const j=jobs[x.id];const running=j&&(j.status==="queued"||j.status==="running");return <button key={x.id} className={"case "+(x.id===caseId?"active":"")} onClick={()=>openCase(x.id)}><span className="caseIcon">{running?<Loader2 size={14} className="spin"/>:x.name[0]?.toUpperCase()}</span><span><b>{x.name}</b><small>{x.metrics?.monthlyVisits?`${compact(x.metrics.monthlyVisits)} visits/mo${x.metrics.revenue?` · ~${compact(x.metrics.revenue.mid,currencySymbol(x.metrics.currency))}/mo`:""}`:x.domain||(x.nodes.find(n=>n.id===x.id+":seed")||x.nodes[0])?.type}</small></span><span className="caseActions"><span role="button" aria-label={`Delete ${x.name}`} onClick={e=>{e.stopPropagation();deleteCase(x.id,x.name)}} title="Delete investigation"><X size={13}/></span><ChevronRight size={14}/></span></button>};
 return <main>{navOpen&&<div className="navBackdrop" onClick={()=>setNavOpen(false)}/>}<aside className={navOpen?"open":""}><button className="logo logoBtn" onClick={()=>{setView("portfolio");setPick(null);setNavOpen(false);setQ("");document.querySelector(".shell")?.scrollTo({top:0})}} aria-label="BrandTracer home — all case files"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="2"/><path d="M20 20l7 7" stroke="#c2412d" strokeWidth="3" strokeLinecap="round"/><circle cx="13" cy="13" r="3" fill="#c2412d"/></svg><span className="wordmark">BrandTracer</span></button>
 <button className="new" onClick={()=>openNew()}><Plus size={16}/> Open new case</button>
 <div className="sideLabel">CASE FILES · {cat==="all"?allCases.length:`${sideCases.length} of ${allCases.length}`}</div><select className="catFilter" value={cat} onChange={e=>setCat(e.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{verticals.map(g=><optgroup key={g.v} label={`${g.v} (${g.n})`}>{g.v!==UNCATEGORIZED&&g.ks.length>1&&<option value={"v:"+g.v}>All {g.v} ({g.n})</option>}{g.ks.map(k=><option key={k} value={k}>{labelOf(k)} ({catCounts.get(k)})</option>)}</optgroup>)}</select><select className="catFilter" value={flag} onChange={e=>setFlag(e.target.value)} aria-label="Filter by risk or ownership"><option value="all">All brands</option><optgroup label="Ownership"><option value="ownership:operator_unknown">Operator unknown</option><option value="ownership:legal_entity_only">Legal entity only</option><option value="ownership:identified">Owner identified</option><option value="needs-deep-dive">Needs deep dive</option><option value="network:*">In a multi-brand network</option></optgroup><optgroup label="Risk"><option value="bbb:F">BBB rated F</option><option value="lawsuit">Lawsuits</option><option value="regulatory">Regulatory action</option><option value="subscription">Subscription brands</option><option value="persona-ads">Persona / doctor ad pages</option><option value="compliance-flags">Ad compliance flags</option><option value="clones">Clone or impostor stores</option><option value="lookalike-script">Lookalike script</option></optgroup><optgroup label="Ad scale"><option value="scale:very high">Very high</option><option value="scale:high">High</option><option value="scale:medium">Medium</option><option value="scale:low">Low</option></optgroup></select><div className="sideFilter"><Search size={13}/><input value={sq} onChange={e=>setSq(e.target.value)} placeholder="Filter investigations" aria-label="Filter investigations"/></div>
 <div className="caseList">{tree.map(g=>{const vOpen=Boolean(sq.trim())||cat!=="all"||openGroups.has("v:"+g.v);return <div key={g.v} className="grp"><button className="grpHead" aria-expanded={vOpen} onClick={()=>toggleGroup("v:"+g.v)}>{vOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<span>{g.v}</span><em>{g.n}</em></button>
  {vOpen&&g.cats.map(ct=>{const cOpen=Boolean(sq.trim())||cat===ct.k||openGroups.has("c:"+ct.k);return <div key={ct.k} className="sub"><button className="subHead" aria-expanded={cOpen} onClick={()=>toggleGroup("c:"+ct.k)}>{cOpen?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<span>{labelOf(ct.k)}</span><em>{ct.items.length}</em></button>{cOpen&&ct.items.map(renderCase)}</div>})}</div>})}{!sideCases.length&&<p className="sideEmpty">{loading?"Loading investigations…":`No investigations match "${sq}".`}</p>}</div>
 <div className="sideLabel bottom">SYSTEM</div><div className="mini"><ShieldCheck size={15}/> Evidence standard: strict</div><div className="mini"><Sparkles size={15}/> Web research: {webResearch===null?"checking…":webResearch?"on":"off"}</div>
 {me&&<AccountMenu me={me} onReplay={()=>{setNavOpen(false);setTour(true)}}/>}
 </aside>{demo&&<Demo onClose={()=>setDemo(false)} onAction={(a:DemoAction)=>{if(a.type==="case"){const x=allCases.find(y=>y.id===a.id);if(!x){setNotice("That example brand isn't in your case files.");return}openCase(a.id);setTab(a.tab||"graph")}else if(a.type==="networks")setView("networks");else if(a.type==="watchlist")setView("watchlist");else if(a.type==="cmd")setCmd(a.q)}}/>}{cmd!==null&&<CommandPalette initial={cmd} onClose={()=>setCmd(null)} onOpenCase={openCase} onResearch={v=>openNew(v)} local={t=>{const l=t.toLowerCase();const out:{group:"brand"|"entity";label:string;detail:string;caseId:string;caseName:string}[]=[];for(const x of allCases){if((x.name+" "+x.domain).toLowerCase().includes(l))out.push({group:"brand",label:x.name,detail:[x.domain,x.category].filter(Boolean).join(" · "),caseId:x.id,caseName:x.name});else{const n=x.nodes.find(n=>n.id!==x.id+":seed"&&n.label.toLowerCase().includes(l));if(n)out.push({group:"entity",label:n.label,detail:n.type,caseId:x.id,caseName:x.name})}if(out.length>40)break}return out}}/>}{tour&&<Onboarding name={me?.full_name} onDone={()=>{setTour(false);setMe(m=>m?{...m,onboarded_at:new Date().toISOString()}:m)}}/>}<section className="shell"><header><button className="menuBtn" onClick={()=>setNavOpen(true)} aria-label="Open investigations"><Menu size={18}/></button><nav className="viewSwitch" aria-label="View"><button aria-pressed={view==="portfolio"} className={view==="portfolio"?"on":""} onClick={()=>setView("portfolio")}>Case files</button><button aria-pressed={view==="networks"} className={view==="networks"?"on":""} onClick={()=>setView("networks")}>Networks</button><button aria-pressed={view==="watchlist"} className={view==="watchlist"?"on":""} onClick={()=>setView("watchlist")}>Watchlist{watch&&watch.unread>0?<span className="badgeDot" aria-label={`${watch.unread} unread changes`}>{watch.unread>99?"99+":watch.unread}</span>:null}</button><button aria-pressed={view==="case"} className={view==="case"?"on":""} onClick={()=>setView("case")} title={c.name}>{c.name.length>16?c.name.slice(0,15)+"…":c.name}</button></nav><button className="demoBtn" onClick={()=>setDemo(true)} aria-label="Demo: see what you can do with BrandTracer"><Play size={14}/><span>Demo</span></button><button className="search searchBtn" onClick={()=>setCmd("")} aria-label="Search everything (⌘K)"><Search size={17}/><span>Search brands, people, pixel IDs, phones…</span><kbd>⌘K</kbd></button><div className="legend"><Badge c="confirmed"/><Badge c="strong"/><Badge c="correlation"/></div></header>

 {view==="portfolio"&&<Portfolio cases={sideCases} total={allCases.length} flag={flag} setFlag={setFlag} onOpen={openCase} watched={watched} onToggleWatch={toggleWatch}/>}
 {view==="watchlist"&&<Watchlist data={watch} cases={allCases} onOpen={openCase} onToggle={toggleWatch} onChecked={()=>{loadWatch();if(db)fetch("/api/investigations").then(r=>r.json()).then(d=>{if(d.cases?.length)setAllCases(prev=>d.cases.map((x:Case)=>prev.find(p=>p.id===x.id&&fullIds.has(x.id))?{...prev.find(p=>p.id===x.id)!,metrics:x.metrics,tags:x.tags}:x))}).catch(()=>{})}} onSeen={markWatchSeen}/>}
 {view==="networks"&&<Networks onOpen={openCase}/>}
 {view==="case"&&<> <div className="content">
 {notice&&<div className="notice"><AlertTriangle size={15}/><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
 <CaseHero c={c} onCategory={k=>updateCase({...c,category:k})} onFilterVertical={v=>setCat("v:"+v)} onOpen={openCase}/>
 <div className="actionbar"><StarButton on={watched.has(c.id)} onClick={()=>toggleWatch(c.id,!watched.has(c.id))}/><button onClick={researchCase} disabled={busy||!db}>{busy?<Loader2 size={14} className="spin"/>:<Search size={14}/>} {busy?"Researching…":"Research again"}</button><button onClick={()=>setEvidenceOpen(true)}><Plus size={14}/> Add evidence</button><span>{!db?"Database not connected · research unavailable":webResearch===false?"Web research is off · add ANTHROPIC_API_KEY in Vercel to research people and companies on the web":"Research checks the site, registrations, archives, your other investigations and the web"}</span></div>
 {job&&<div className={"jobBar "+job.status}><div className="jobHead">{busy?<Loader2 size={15} className="spin"/>:job.status==="completed"&&!/^Partial/.test(job.message||"")?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}<b>{busy?"Research in progress":job.status==="completed"?(/^Partial/.test(job.message||"")?"Research partly failed":"Research complete"):"Research failed"}</b><span>{job.seed_value}</span></div><div className="jobTrack"><i style={{width:`${Math.max(4,job.progress||0)}%`}}/></div><p>{job.message}</p></div>}
 <nav><button className={tab==="graph"?"sel":""} onClick={()=>setTab("graph")}><Network size={15}/> Relationship graph</button><button className={tab==="evidence"?"sel":""} onClick={()=>setTab("evidence")}><FileText size={15}/> Evidence · {c.evidence.length}</button><button className={tab==="timeline"?"sel":""} onClick={()=>setTab("timeline")}><Clock3 size={15}/> Timeline · {c.timeline.length}</button><button className={tab==="profile"?"sel":""} onClick={()=>setTab("profile")}><Fingerprint size={15}/> Profile</button><button className={tab==="marketing"?"sel":""} onClick={()=>setTab("marketing")}><Megaphone size={15}/> Marketing</button></nav>
 {tab==="graph"&&<div className="panel"><div className="panelHead"><div><b>Network map</b><span>Select any node to see what is known and research it further</span></div><span>{c.nodes.length} entities · {c.edges.length} links</span></div>{c.nodes.length>1?<Graph nodes={c.nodes} edges={c.edges} onPick={setPick}/>:<div className="emptyPanel">{busy?"Research is running. The graph fills in when it finishes.":"Nothing mapped yet. Run research to build the graph."}</div>}</div>}
 {tab==="evidence"&&<div className="panel evidence">{c.evidence.length?c.evidence.map(e=><article key={e.id}><div><Badge c={e.confidence}/><h3>{e.title}</h3><p>{e.note}</p></div><span className="src">{isUrl(e.source)?<a href={e.source} target="_blank" rel="noopener noreferrer">{e.source}</a>:e.source}</span></article>):<div className="emptyPanel">No evidence yet.</div>}</div>}
 {tab==="profile"&&<ProfilePanel c={c} onOpen={openCase}/>}
 {tab==="marketing"&&<MarketingPanel c={c}/>}
 {tab==="timeline"&&<div className="panel timeline">{timeline.length?timeline.map((t,i)=><article key={i}><div className="dot"/><time>{t.date}</time><div><h3>{t.title}</h3><p>{t.body}</p></div></article>):<div className="emptyPanel">No dated events yet.</div>}</div>}
 <div className="questions"><b>OPEN QUESTIONS · NEXT PIVOTS</b>{c.openQuestions.length?c.openQuestions.map((x,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{x}</div>):<div>None yet.</div>}</div></div></>}</section>
 {pick&&<div className="drawer"><button className="close" onClick={()=>setPick(null)} aria-label="Close"><X/></button><div className="drawerType">{pick.type.toUpperCase()}</div><h2>{pick.label}</h2>{siteHost(pick.type==="domain"?pick.label:/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(pick.label)?.[1])&&<SiteLink className="drawerSite" domain={pick.type==="domain"?pick.label:/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(pick.label)?.[1]} label="Visit site"/>}<p className="sub">{pick.subtitle}</p><Badge c={pick.confidence}/><hr/><b>KNOWN FACTS</b>{pick.details.length?pick.details.map((d,i)=><p className="fact" key={i}>{d}</p>):<p className="fact">No details recorded.</p>}
  {pickEdges.length>0&&<><hr/><b>RELATIONSHIPS</b>{pickEdges.map((e,i)=>{const other=c.nodes.find(n=>n.id===(e.from===pick.id?e.to:e.from));return <p className="fact" key={i} style={{borderColor:cc[e.confidence]}}>{e.from===pick.id?`${e.label} → ${other?.label}`:`${other?.label} → ${e.label}`} <span style={{color:cc[e.confidence]}}>({e.confidence})</span></p>})}</>}
  <hr/><button className="expand" onClick={()=>researchNode(pick)} disabled={busy||!db}><Search size={15}/> Research this {pick.type}</button><button className="expand" onClick={()=>{const d=(pick.type==="domain"?pick.label:/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(pick.label)?.[1]||"").toLowerCase().replace(/^www\./,"");const existing=d&&allCases.find(x=>x.domain&&x.domain.toLowerCase().replace(/^www\./,"")===d);if(existing){openCase(existing.id);return}startResearch({seedValue:pick.label,seedType:pick.type});setPick(null)}} disabled={!db}><Plus size={15}/> Open as new investigation</button><button className="expand ghost" onClick={()=>setPivotOpen(true)}><Plus size={15}/> Add manual pivot</button><p className="hint">Research adds what it finds to this graph, with evidence for each link.</p></div>}
 {newOpen&&<div className="modalBackdrop"><form className="modal" onSubmit={submitNew}><button type="button" className="close" onClick={()=>setNewOpen(false)} aria-label="Close"><X/></button><div className="drawerType">NEW INVESTIGATION</div><h2>What do you want to research?</h2>
  <label>Brand, domain, person, company, trademark, email, phone or address<input autoFocus name="value" required value={newSeed.value} onChange={e=>setNewSeed(s=>({...s,value:e.target.value}))} placeholder="e.g. resilia.shop, Sack Consulting Inc., Johnathan Sack"/></label>
  <label>It is a<select name="seedType" value={newSeed.type} onChange={e=>setNewSeed(s=>({...s,type:e.target.value}))}><option value="auto">Detect automatically{guessed?` (${TYPES.find(t=>t.value===guessed)?.label})`:""}</option>{TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
  <label>Investigation name (optional)<input name="name" value={newSeed.name} onChange={e=>setNewSeed(s=>({...s,name:e.target.value}))} placeholder="Defaults to what you entered"/></label>
  {webResearch===false&&<p className="hint left">Web research is off. Domains still get site, registration, archive and certificate checks, and every search is matched against your existing investigations. Add ANTHROPIC_API_KEY in Vercel to research people, companies and brands on the web.</p>}
  <button className="expand" type="submit"><Sparkles size={15}/> Start research</button></form></div>}
 {pivotOpen&&pick&&<div className="modalBackdrop"><form className="modal" action={createPivot}><button type="button" className="close" onClick={()=>setPivotOpen(false)} aria-label="Close"><X/></button><div className="drawerType">MANUAL PIVOT</div><h2>Add a lead from {pick.label}</h2><label>Discovered identifier<input name="label" required placeholder="Person, LLC, domain, phone…"/></label><label>Entity type<select name="type" defaultValue="company">{TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label>Why this pivot matters<textarea name="note" placeholder="Evidence or clue connecting this node…"/></label><button className="expand" type="submit">Add pivot to graph</button></form></div>}
 {evidenceOpen&&<div className="modalBackdrop"><form className="modal" action={createEvidenceItem}><button type="button" className="close" onClick={()=>setEvidenceOpen(false)} aria-label="Close"><X/></button><div className="drawerType">EVIDENCE VAULT</div><h2>Add evidence</h2><label>Title<input name="title" required/></label><label>Source<input name="source" required placeholder="URL, registry, USPTO serial, first-party terms…"/></label><label>Confidence<select name="confidence" defaultValue="lead"><option value="confirmed">Confirmed</option><option value="strong">Strong</option><option value="correlation">Correlation</option><option value="lead">Lead</option><option value="excluded">Excluded</option></select></label><label>Evidence note<textarea name="note" required/></label><button className="expand" type="submit">Save evidence</button></form></div>}
 </main>;
}
