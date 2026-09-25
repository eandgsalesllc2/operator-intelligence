"use client";
import {useMemo,useState} from "react";
import {Search,Network,ShieldCheck,FileText,Clock3,Plus,ChevronRight,Building2,UserRound,Globe2,Tags,MapPin,X,ExternalLink} from "lucide-react";
import {cases} from "@/lib/data"; import {Confidence,Edge,IntelNode} from "@/lib/types";
const cc:Record<Confidence,string>={confirmed:"#35d07f",strong:"#4aa8ff",correlation:"#f5b942",lead:"#929baa",excluded:"#ff6470"};
const icons:any={brand:Globe2,person:UserRound,company:Building2,trademark:Tags,domain:Globe2,address:MapPin};
function Badge({c}:{c:Confidence}){return <span className="badge" style={{color:cc[c],borderColor:cc[c]+"55",background:cc[c]+"12"}}><i style={{background:cc[c]}}/>{c}</span>}
function Graph({nodes,edges,onPick}:{nodes:IntelNode[],edges:Edge[],onPick:(n:IntelNode)=>void}){
 const by=Object.fromEntries(nodes.map(n=>[n.id,n])); return <div className="graph"><svg viewBox="0 0 900 510" preserveAspectRatio="xMidYMid meet">
 <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#526071"/></marker></defs>
 {edges.map((e:Edge,i:number)=>{let a=by[e.from],b=by[e.to];if(!a||!b)return null;return <g key={i}><line x1={a.x+65} y1={a.y+22} x2={b.x+65} y2={b.y+22} stroke={cc[e.confidence]} strokeOpacity=".55" strokeWidth="1.6" markerEnd="url(#arrow)"/><text x={(a.x+b.x)/2+65} y={(a.y+b.y)/2+14} className="edgeLabel">{e.label}</text></g>})}
 {nodes.map(n=>{const I=icons[n.type]||Globe2;return <g key={n.id} onClick={()=>onPick(n)} className="node" transform={`translate(${n.x},${n.y})`}><rect width="145" height="55" rx="10" fill="#101923" stroke={cc[n.confidence]} strokeOpacity=".55"/><circle cx="20" cy="27" r="12" fill={cc[n.confidence]+"20"}/><foreignObject x="12" y="19" width="16" height="16"><I size={16} color={cc[n.confidence]}/></foreignObject><text x="39" y="23" className="nodeTitle">{n.label.length>18?n.label.slice(0,18)+"…":n.label}</text><text x="39" y="39" className="nodeSub">{n.subtitle.length>20?n.subtitle.slice(0,20)+"…":n.subtitle}</text></g>})}</svg></div>
}
export default function Dashboard(){
 const [caseId,setCaseId]=useState("ultimapeak"),[tab,setTab]=useState("graph"),[pick,setPick]=useState<IntelNode|null>(null),[q,setQ]=useState("");
 const c=cases.find(x=>x.id===caseId)!; const matches=useMemo(()=>cases.filter(x=>(x.name+" "+x.domain+" "+x.summary).toLowerCase().includes(q.toLowerCase())),[q]);
 const confirmed=c.nodes.filter(n=>n.confidence==="confirmed").length, strong=c.nodes.filter(n=>n.confidence==="strong").length;
 return <main><aside><div className="logo"><div className="mark"><Network size={18}/></div><div>OPERATOR <b>INTELLIGENCE</b></div></div>
 <button className="new"><Plus size={16}/> New investigation</button>
 <div className="sideLabel">INVESTIGATIONS</div>{cases.map(x=><button key={x.id} className={"case "+(x.id===caseId?"active":"")} onClick={()=>{setCaseId(x.id);setPick(null)}}><span className="caseIcon">{x.name[0]}</span><span><b>{x.name}</b><small>{x.domain}</small></span><ChevronRight size={14}/></button>)}
 <div className="sideLabel bottom">SYSTEM</div><div className="mini"><ShieldCheck size={15}/> Evidence standard: strict</div><div className="mini"><Network size={15}/> 3 seeded networks</div>
 </aside><section className="shell"><header><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search brands, people, companies, domains…"/></div><div className="legend"><Badge c="confirmed"/><Badge c="strong"/><Badge c="correlation"/></div></header>
 {q&&<div className="results">{matches.map(x=><button onClick={()=>{setCaseId(x.id);setQ("")}}><b>{x.name}</b><span>{x.domain}</span></button>)}</div>}
 <div className="content"><div className="crumb">INVESTIGATIONS / <span>{c.name.toUpperCase()}</span></div><div className="titleRow"><div><h1>{c.name}</h1><p>{c.domain} · {c.status}</p></div><button className="investigate"><Search size={16}/> Investigate this node</button></div>
 <div className="summary">{c.summary}</div><div className="stats"><div><small>NODES</small><b>{c.nodes.length}</b></div><div><small>RELATIONSHIPS</small><b>{c.edges.length}</b></div><div><small>CONFIRMED</small><b className="green">{confirmed}</b></div><div><small>STRONG</small><b className="blue">{strong}</b></div><div><small>EVIDENCE</small><b>{c.evidence.length}</b></div></div>
 <nav><button className={tab==="graph"?"sel":""} onClick={()=>setTab("graph")}><Network size={15}/> Relationship graph</button><button className={tab==="evidence"?"sel":""} onClick={()=>setTab("evidence")}><FileText size={15}/> Evidence</button><button className={tab==="timeline"?"sel":""} onClick={()=>setTab("timeline")}><Clock3 size={15}/> Timeline</button></nav>
 {tab==="graph"&&<div className="panel"><div className="panelHead"><div><b>Network map</b><span>Click any node to inspect its evidence trail</span></div><span>{c.nodes.length} entities · {c.edges.length} links</span></div><Graph nodes={c.nodes} edges={c.edges} onPick={setPick}/></div>}
 {tab==="evidence"&&<div className="panel evidence">{c.evidence.map(e=><article key={e.id}><div><Badge c={e.confidence}/><h3>{e.title}</h3><p>{e.note}</p></div><span>{e.source}</span></article>)}</div>}
 {tab==="timeline"&&<div className="panel timeline">{c.timeline.map((t,i)=><article key={i}><div className="dot"/><time>{t.date}</time><div><h3>{t.title}</h3><p>{t.body}</p></div></article>)}</div>}
 <div className="questions"><b>OPEN QUESTIONS · NEXT PIVOTS</b>{c.openQuestions.map((x,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{x}</div>)}</div></div></section>
 {pick&&<div className="drawer"><button className="close" onClick={()=>setPick(null)}><X/></button><div className="drawerType">{pick.type.toUpperCase()}</div><h2>{pick.label}</h2><p className="sub">{pick.subtitle}</p><Badge c={pick.confidence}/><hr/><b>KNOWN FACTS</b>{pick.details.map((d,i)=><p className="fact" key={i}>{d}</p>)}<hr/><button className="expand"><Search size={15}/> Investigate this node</button><p className="hint">Creates a new pivot from this entity and preserves the current evidence chain.</p></div>}
 </main>
}