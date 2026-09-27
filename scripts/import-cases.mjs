#!/usr/bin/env node
// Import investigation cases (casedata JSON) into Operator Intelligence.
//
// Usage:
//   node scripts/import-cases.mjs <dir>                 # dry run: validate + print what would be written
//   node scripts/import-cases.mjs <dir> --api <baseUrl> # POST each case to <baseUrl>/api/investigations
//
// Case files follow lib/types.ts `Case`, minus node coordinates (a radial layout is assigned here).
// Entity and evidence ids are primary keys shared across all investigations, so they are
// prefixed with the case id to avoid collisions (e.g. "brand" -> "sp26-resilia:brand").
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";

const TYPES=new Set(["brand","person","company","trademark","domain","address","phone","email"]);
const CONF=new Set(["confirmed","strong","correlation","lead","excluded"]);
const W=900,H=510,CX=450,CY=255;

function validate(c,file){
  const errs=[];
  if(!c.id||!c.name)errs.push("missing id/name");
  const ids=new Set();
  for(const n of c.nodes||[]){
    if(ids.has(n.id))errs.push(`duplicate node ${n.id}`);ids.add(n.id);
    if(!TYPES.has(n.type))errs.push(`node ${n.id}: bad type ${n.type}`);
    if(!CONF.has(n.confidence))errs.push(`node ${n.id}: bad confidence ${n.confidence}`);
  }
  if(!ids.has("brand"))errs.push("no node with id 'brand'");
  for(const e of c.edges||[]){
    if(!ids.has(e.from)||!ids.has(e.to))errs.push(`edge ${e.from}->${e.to}: unknown node`);
    if(!CONF.has(e.confidence))errs.push(`edge ${e.from}->${e.to}: bad confidence`);
  }
  for(const e of c.evidence||[]){
    if(!/^https?:\/\//.test(e.source||""))errs.push(`evidence ${e.id}: source is not a URL`);
    if(!CONF.has(e.confidence))errs.push(`evidence ${e.id}: bad confidence`);
  }
  if(errs.length)throw new Error(`${file}: ${errs.join("; ")}`);
}

// Brand in the centre, everything else on an ellipse ordered by type so related nodes sit together.
function layout(nodes){
  const order=["company","trademark","person","brand","domain","address","phone","email"];
  const rest=nodes.filter(n=>n.id!=="brand").sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type));
  const rx=W/2-110,ry=H/2-60;
  return nodes.map(n=>{
    if(n.id==="brand")return {...n,x:CX,y:CY};
    const i=rest.indexOf(n),a=-Math.PI/2+(2*Math.PI*i)/rest.length;
    return {...n,x:Math.round(CX+rx*Math.cos(a)),y:Math.round(CY+ry*Math.sin(a))};
  });
}

function toCase(c){
  const p=id=>`${c.id}:${id}`;
  return {
    id:c.id,name:c.name,domain:c.domain||"",status:c.status||"Active investigation",category:c.category||"",
    summary:c.network?`[${c.network}] ${c.summary}`:c.summary,
    nodes:layout(c.nodes).map(n=>({id:p(n.id),label:n.label,type:n.type,subtitle:n.subtitle||"",x:n.x,y:n.y,confidence:n.confidence,details:n.details||[]})),
    edges:c.edges.map(e=>({from:p(e.from),to:p(e.to),label:e.label,confidence:e.confidence})),
    evidence:(c.evidence||[]).map(e=>({id:p(e.id),title:e.title,source:e.source,confidence:e.confidence,note:e.note||""})),
    timeline:c.timeline||[],openQuestions:c.openQuestions||[],
  };
}

const [dir,...args]=process.argv.slice(2);
if(!dir){console.error("usage: node scripts/import-cases.mjs <dir> [--api <baseUrl>]");process.exit(1)}
const api=args[args.indexOf("--api")+1]&&args.includes("--api")?args[args.indexOf("--api")+1].replace(/\/$/,""):null;

const files=readdirSync(dir).filter(f=>f.endsWith(".json")).sort();
const cases=files.map(f=>{const c=JSON.parse(readFileSync(join(dir,f),"utf8"));validate(c,f);return toCase(c)});
console.log(`${cases.length} cases valid (${cases.reduce((s,c)=>s+c.nodes.length,0)} entities, ${cases.reduce((s,c)=>s+c.edges.length,0)} relationships, ${cases.reduce((s,c)=>s+c.evidence.length,0)} evidence items)`);

if(!api){for(const c of cases)console.log(`  ${c.id.padEnd(26)} ${String(c.nodes.length).padStart(2)} nodes  ${String(c.evidence.length).padStart(2)} evidence  ${c.name}`);console.log("Dry run. Pass --api <baseUrl> to write.");process.exit(0)}

let failed=0;
for(const c of cases){
  const r=await fetch(`${api}/api/investigations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c)});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body.error){failed++;console.error(`✗ ${c.id}: ${body.error||r.status}`)}else console.log(`✓ ${c.id}`);
}
process.exit(failed?1:0);
