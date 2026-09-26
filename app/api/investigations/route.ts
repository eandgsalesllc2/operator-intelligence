import {NextResponse} from "next/server";import {databaseConfigured,listInvestigations,saveInvestigation,deleteInvestigation} from "@/lib/repository";import {Case} from "@/lib/types";
export async function GET(){try{return NextResponse.json({cases:await listInvestigations(),database:databaseConfigured()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Database error"},{status:500})}}
export async function POST(req:Request){try{const c=await req.json() as Case;return NextResponse.json({case:await saveInvestigation(c),database:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Database error"},{status:500})}}

export async function DELETE(req:Request){try{const {id}=await req.json();if(!id)return NextResponse.json({error:"Investigation id is required"},{status:400});return NextResponse.json({deleted:await deleteInvestigation(id)})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Delete failed"},{status:500})}}
