import {Case,Confidence,IntelNode,NodeType} from "./types";
import {normalizeEntity} from "./confidence";

// Providers produce Drafts: nodes keyed by a normalized "type:value" key (the seed is
// always "seed"), plus edges, evidence, timeline and questions. mergeDraft folds a draft
// into a Case, deduplicating by key and keeping the strongest confidence seen.

export type DraftNode={key:string;label:string;type:NodeType;subtitle:string;confidence:Confidence;details:string[]};
export type DraftEdge={from:string;to:string;label:string;confidence:Confidence};
export type DraftEvidence={title:string;source:string;confidence:Confidence;note:string};
export type Draft={nodes:DraftNode[];edges:DraftEdge[];evidence:DraftEvidence[];timeline:{date:string;title:string;body:string}[];questions:string[];summary?:string};

export const emptyDraft=():Draft=>({nodes:[],edges:[],evidence:[],timeline:[],questions:[]});
export const RANK:Record<Confidence,number>={confirmed:0,strong:1,correlation:2,lead:3,excluded:4};
const stronger=(a:Confidence,b:Confidence)=>a==="excluded"||b==="excluded"?(a==="excluded"?b:a):(RANK[a]<=RANK[b]?a:b);

export const keyFor=(type:NodeType,label:string)=>{
 let v=normalizeEntity(type,label).toLowerCase();
 if(type==="address")v=v.replace(/\bnorth\b/g,"n").replace(/\bsouth\b/g,"s").replace(/\beast\b/g,"e").replace(/\bwest\b/g,"w").replace(/\bstreet\b/g,"st").replace(/\bavenue\b/g,"ave").replace(/\broad\b/g,"rd").replace(/\bsuite\b|\bste\b/g,"ste").replace(/\bboulevard\b/g,"blvd").replace(/\bdrive\b/g,"dr").replace(/[.,#]/g," ").replace(/\bste\s+\w+/g,"").replace(/\s+/g," ").trim();
 if(type==="company")v=v.replace(/[.,]/g,"").replace(/\s+/g," ").replace(/\b(l\s?l\s?c|inc|incorporated|corp|corporation|ltd|limited|co)\b/g,m=>m.replace(/\s/g,""));
 return type+":"+v;
};

export function addNode(d:Draft,n:Omit<DraftNode,"key">&{key?:string}){
 const key=n.key||keyFor(n.type,n.label);
 const hit=d.nodes.find(x=>x.key===key);
 if(hit){hit.confidence=stronger(hit.confidence,n.confidence);for(const s of n.details)if(!hit.details.includes(s))hit.details.push(s);if(!hit.subtitle&&n.subtitle)hit.subtitle=n.subtitle}
 else d.nodes.push({...n,key,details:[...n.details]});
 return key;
}
export function addEdge(d:Draft,e:DraftEdge){
 if(e.from===e.to)return;
 const hit=d.edges.find(x=>x.from===e.from&&x.to===e.to&&x.label===e.label);
 if(hit)hit.confidence=stronger(hit.confidence,e.confidence);else d.edges.push({...e});
}
export function addEvidence(d:Draft,e:DraftEvidence){
 if(!d.evidence.some(x=>x.source===e.source&&x.title===e.title))d.evidence.push(e);
}

function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

// Seed node in the middle, the rest on concentric rings grouped by type.
export function layout(nodes:IntelNode[],seedId:string){
 const order:NodeType[]=["company","person","trademark","brand","domain","email","phone","address"];
 const rest=nodes.filter(n=>n.id!==seedId).sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)||a.label.localeCompare(b.label));
 const cx=380,cy=230,out=nodes.map(n=>({...n}));
 const seed=out.find(n=>n.id===seedId);if(seed){seed.x=cx;seed.y=cy}
 let i=0,ring=0;
 while(i<rest.length){
  const cap=ring===0?10:14+ring*6, count=Math.min(cap,rest.length-i), rx=330+ring*230, ry=190+ring*150;
  for(let j=0;j<count;j++,i++){
   const a=-Math.PI/2+(2*Math.PI*j)/count+(ring%2?Math.PI/count:0);
   const n=out.find(x=>x.id===rest[i].id)!;n.x=Math.round(cx+rx*Math.cos(a));n.y=Math.round(cy+ry*Math.sin(a));
  }
  ring++;
 }
 return out;
}

export function mergeDraft(c:Case,d:Draft,seedNodeId:string):Case{
 const byKey=new Map<string,string>();
 // Existing nodes keep their ids; match drafts to them by key.
 for(const n of c.nodes)byKey.set(n.id===seedNodeId?"seed":keyFor(n.type,n.label),n.id);
 const nodes=c.nodes.map(n=>({...n,details:[...n.details]}));
 for(const dn of d.nodes){
  const existing=byKey.get(dn.key);
  if(existing){
   const n=nodes.find(x=>x.id===existing)!;
   n.confidence=stronger(n.confidence,dn.confidence);
   for(const s of dn.details)if(!n.details.includes(s))n.details.push(s);
   if((!n.subtitle||n.subtitle==="Investigation seed")&&dn.subtitle)n.subtitle=dn.subtitle;
  }else{
   const id=c.id+":"+hash(dn.key);
   byKey.set(dn.key,id);
   nodes.push({id,label:dn.label,type:dn.type,subtitle:dn.subtitle,x:0,y:0,confidence:dn.confidence,details:dn.details});
  }
 }
 const edges=[...c.edges];
 for(const e of d.edges){
  const from=byKey.get(e.from),to=byKey.get(e.to);
  if(!from||!to||from===to)continue;
  const hit=edges.find(x=>x.from===from&&x.to===to&&x.label===e.label);
  if(hit)hit.confidence=stronger(hit.confidence,e.confidence);else edges.push({from,to,label:e.label,confidence:e.confidence});
 }
 const evidence=[...c.evidence];
 for(const e of d.evidence){
  if(evidence.some(x=>x.source===e.source&&x.title===e.title))continue;
  evidence.push({id:c.id+":ev-"+hash(e.source+"|"+e.title),title:e.title,source:e.source,confidence:e.confidence,note:e.note});
 }
 const timeline=[...c.timeline];
 for(const t of d.timeline)if(!timeline.some(x=>x.date===t.date&&x.title===t.title))timeline.push(t);
 timeline.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const openQuestions=[...c.openQuestions];
 for(const q of d.questions)if(!openQuestions.includes(q))openQuestions.push(q);
 return {...c,summary:d.summary||c.summary,nodes:layout(nodes,seedNodeId),edges,evidence,timeline,openQuestions:openQuestions.slice(0,15)};
}
