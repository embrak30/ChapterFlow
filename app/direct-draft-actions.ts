"use server";
import { createClient } from '@/lib/supabase/server';
import { draftWorkflow } from '@/lib/draft-workflow';
import { manuscriptMetadata } from '@/lib/manuscript-metadata';
import { revalidatePath } from 'next/cache';

export async function prepareDirectDraft(input:{bookId:string;chapterId:string;stage:string;fileName:string;size:number;notes:string}) {
  try {
    const metadata=manuscriptMetadata(input.fileName,input.size);
    if(input.notes.length>20000) throw new Error('Please shorten the upload notes.');
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user) throw new Error('Please sign in again before uploading.');
    const {data:chapter,error}=await supabase.from('chapters').select('id,stage,status,submissions!submissions_chapter_id_fkey(stage,submission_files(id)),peer_review_feedback_packets(status),chapter_production(third_draft_requested_at,editorial_state)').eq('id',input.chapterId).eq('book_id',input.bookId).eq('author_id',user.id).single();
    if(error || !chapter) throw new Error('Your chapter could not be loaded. Contact the editor.');
    const workflow=draftWorkflow(chapter);
    if(!workflow.canUpload || workflow.uploadStage!==input.stage) throw new Error('Your draft stage has changed. Refresh before uploading.');
    const id=crypto.randomUUID();
    const path=`${input.bookId}/${input.chapterId}/${user.id}/direct/${id}/manuscript.${metadata.contentType==='application/msword'?'doc':'docx'}`;
    const {error:sessionError}=await supabase.from('draft_upload_sessions').insert({id,chapter_id:input.chapterId,author_id:user.id,storage_path:path,file_name:metadata.fileName,expected_size:metadata.size,content_type:metadata.contentType,stage:input.stage,notes:input.notes});
    if(sessionError) throw new Error(`Upload could not be prepared: ${sessionError.message}`);
    const {data:signed,error:signError}=await supabase.storage.from('chapter-drafts').createSignedUploadUrl(path);
    if(signError || !signed) throw new Error(`Upload permission could not be created: ${signError?.message ?? 'no upload link returned'}`);
    return {sessionId:id,path,token:signed.token,contentType:metadata.contentType};
  } catch(error) { return {error:error instanceof Error?error.message:'The upload could not be prepared.'}; }
}

export async function finishDirectDraft(sessionId:string) {
  try {
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user) throw new Error('Please sign in again to finish recording the upload.');
    const {data,error}=await supabase.rpc('complete_direct_draft_upload',{p_session_id:sessionId});
    if(error || !data) throw new Error(`The file could not be recorded: ${error?.message ?? 'save not confirmed'}`);
    revalidatePath('/');return {success:true};
  } catch(error) {return {error:error instanceof Error?error.message:'The upload could not be recorded.'};}
}
