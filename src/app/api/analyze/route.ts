import { NextResponse } from 'next/server';
import { analyzeProject, type SourceFile } from '@/lib/analyzer';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const body=await req.json();
  const rawFiles:unknown=Array.isArray(body.files)?body.files:
   (typeof body.code==='string'?[{path:typeof body.file==='string'?body.file:`snippet.${body.language==='python'?'py':'js'}`,content:body.code}]:[]);
  if(!Array.isArray(rawFiles)||rawFiles.length===0||rawFiles.length>120)return NextResponse.json({error:'Choose 1–120 source files.'},{status:400});
  const files:SourceFile[]=[];
  let total=0;
  for(const item of rawFiles){
   if(!item||typeof item.path!=='string'||typeof item.content!=='string'||item.path.length>260||item.content.length>400000)return NextResponse.json({error:'Invalid file input or file over 400 KB.'},{status:400});
   total+=item.content.length;if(total>2000000)return NextResponse.json({error:'Project limit is 2 million characters.'},{status:413});
   files.push({path:item.path,content:item.content});
  }
  const disabled=Array.isArray(body.disabled)?body.disabled.filter((v:unknown)=>typeof v==='string').slice(0,100):[];
  const result=analyzeProject(files,disabled);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Invalid JSON request.'},{status:400});}
}
