import type {Metadata} from "next";
import "./globals.css";

// Fonts load from Google Fonts at runtime (not at build time, which fails when Google's font API hiccups).
const FONTS="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export const metadata:Metadata={title:"BrandTracer",description:"Trace who really owns and operates any DTC brand — ownership, sister brands, ads and funnels, with the evidence."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href={FONTS}/></head><body>{children}</body></html>}
