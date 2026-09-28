"use client";
import {ExternalLink} from "lucide-react";

// A brand's domain as a link that opens the live site in a new tab (never the case — clicks don't bubble).
export const siteHost=(d?:string|null)=>{const h=String(d||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#\s]/)[0];return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(h)?h:""};
export default function SiteLink({domain,label,className}:{domain?:string|null;label?:string;className?:string}){
 const host=siteHost(domain);
 if(!host)return <span className={className}>{label??domain??""}</span>;
 return <a className={"siteLink "+(className||"")} href={`https://${host}`} target="_blank" rel="noopener noreferrer nofollow" title={`Open ${host} in a new tab`} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>{label??host}<ExternalLink size={11} aria-hidden="true"/></a>;
}
