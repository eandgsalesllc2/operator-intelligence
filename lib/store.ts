"use client";
import {Case,Confidence,Evidence,IntelNode,InvestigationDraft} from "./types";
import {cases as seedCases} from "./data";

const KEY="operator-intelligence:v2:cases";
const cloneSeeds=()=>JSON.parse(JSON.stringify(seedCases)) as Case[];
export function loadCases():Case[]{if(typeof window==="undefined")return cloneSeeds();try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):cloneSeeds()}catch{return cloneSeeds()}}
export function saveCases(cases:Case[]){if(typeof window!=="undefined")localStorage.setItem(KEY,JSON.stringify(cases))}
export function resetCases(){if(typeof window!=="undefined")localStorage.removeItem(KEY)}
export function slug(v:string){return v.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||crypto.randomUUID()}
export function createInvestigation(d:InvestigationDraft):Case{
 const id=slug(d.name||d.domain)+"-"+Date.now().toString(36); const label=d.name.trim()||d.domain.trim()||"Untitled investigation";
 const domain=d.domain.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
 return {id,name:label,domain,status:"Active investigation",summary:d.notes.trim()||`New investigation seeded from ${d.seedType}: ${domain||label}. Evidence has not yet been established.`,nodes:[{id:id+"-seed",label,type:d.seedType,subtitle:domain||"Investigation seed",x:375,y:215,confidence:"lead",details:[d.notes.trim()||"Initial investigation seed"]}],edges:[],evidence:[],timeline:[{date:new Date().toISOString().slice(0,10),title:"Investigation created",body:`Seeded from ${d.seedType}: ${domain||label}.`}],openQuestions:["Resolve the legal operating entity.","Identify people directly tied to the operation.","Find authoritative trademark / corporate records.","Search for reusable infrastructure and sibling brands."]};
}
export function pivotNode(c:Case,parent:IntelNode,label:string,type:IntelNode["type"],note:string):Case{
 const id=c.id+"-"+slug(label)+"-"+Date.now().toString(36); const n:IntelNode={id,label,type,subtitle:"Investigation pivot",x:Math.max(40,Math.min(720,parent.x+(parent.x>420?-220:220))),y:Math.max(40,Math.min(430,parent.y+(parent.y>250?-130:130))),confidence:"lead",details:[note||`Pivot created from ${parent.label}`]};
 return {...c,nodes:[...c.nodes,n],edges:[...c.edges,{from:parent.id,to:id,label:"PIVOT / INVESTIGATE",confidence:"lead"}],timeline:[...c.timeline,{date:new Date().toISOString().slice(0,10),title:`Pivot: ${label}`,body:`Created from ${parent.label}. ${note}`} ]};
}
export function addEvidence(c:Case,title:string,source:string,note:string,confidence:Confidence):Case{
 const e:Evidence={id:"ev-"+Date.now().toString(36),title,source,confidence,note}; return {...c,evidence:[e,...c.evidence]};
}
