import type {Metadata} from "next";
import {Fraunces,IBM_Plex_Mono,IBM_Plex_Sans} from "next/font/google";
import "./globals.css";

const display=Fraunces({subsets:["latin"],weight:["400","600","800"],variable:"--f-display",display:"swap"});
const body=IBM_Plex_Sans({subsets:["latin"],weight:["400","500","600"],variable:"--f-body",display:"swap"});
const mono=IBM_Plex_Mono({subsets:["latin"],weight:["400","500"],variable:"--f-mono",display:"swap"});

export const metadata:Metadata={title:"BrandTracer",description:"Trace who really owns and operates any DTC brand — ownership, sister brands, ads and funnels, with the evidence."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}><body>{children}</body></html>}
