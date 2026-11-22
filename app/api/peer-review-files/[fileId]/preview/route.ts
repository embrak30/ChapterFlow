import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request:Request,{params}:{params:Promise<{fileId:string}>}) {
  const {fileId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const headers={'Cache-Control':'private, no-store'};
  if(!user) return NextResponse.json({error:'Sign in to read this chapter.'},{status:401,headers});
  const {data:file}=await supabase.from('peer_review_files').select('storage_path,file_name,status,chapter_id,book_id').eq('id',fileId).single();
  if(!file || file.status!=='approved') return NextResponse.json({error:'No approved review copy is available to your account.'},{status:404,headers});
  const {data:editor}=await supabase.rpc('can_edit_project',{b:file.book_id});
  if(!editor) {
    const {data:assignment}=await supabase.from('peer_review_assignments').select('id').eq('chapter_id',file.chapter_id).eq('reviewer_id',user.id).maybeSingle();
    const {data:settings}=await supabase.from('peer_review_settings').select('is_open').eq('book_id',file.book_id).single();
    if(!assignment || !settings?.is_open) return NextResponse.json({error:'This chapter is not open for your review.'},{status:403,headers});
  }
  if(!file.file_name.toLowerCase().endsWith('.docx')) return NextResponse.json({error:'Inline reading supports .docx copies. Use Download Word copy for this older Word file.'},{status:415,headers});
  const {data:blob,error}=await supabase.storage.from('chapter-drafts').download(file.storage_path);
  if(error || !blob) return NextResponse.json({error:'The review copy could not be loaded.'},{status:404,headers});
  if(blob.size>20*1024*1024) return NextResponse.json({error:'This file is too large for inline reading. Download the Word copy instead.'},{status:413,headers});
  try {
    const {value}=await mammoth.extractRawText({buffer:Buffer.from(await blob.arrayBuffer())});
    if(!value.trim()) return NextResponse.json({error:'No readable text was found. Download the Word copy to check the document.'},{status:422,headers});
    if(value.length>500000) return NextResponse.json({error:'The text is too long for inline reading. Download the Word copy instead.'},{status:413,headers});
    return NextResponse.json({text:value},{headers});
  } catch { return NextResponse.json({error:'This Word file could not be previewed. Download the copy instead.'},{status:422,headers}); }
}
