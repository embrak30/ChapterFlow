"use client";
import { useEffect,useState } from 'react';

export function ReviewDocumentReader({fileId,active}:{fileId:string;active:boolean}) {
  const [text,setText]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!active) return;
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(`/api/peer-review-files/${fileId}/preview`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      const result=await response.json();
      if(!response.ok || typeof result.text!=='string') throw new Error(result.error || 'Unable to load this chapter.');
      setText(result.text);
    }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Unable to load this chapter.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[fileId,active,attempt]);
  return <section className="peer-document-panel review-reader-pane" aria-label="Anonymised chapter reader">
    <div className="reader-toolbar"><strong>Anonymised chapter</strong><a href={`/api/peer-review-files/${fileId}`} target="_blank" rel="noreferrer">Download Word copy</a></div>
    <p className="reader-format-note">Text view. Use the Word copy to inspect tables, figures and original formatting.</p>
    <div className="review-reader-text" tabIndex={0} aria-busy={loading}>
      {loading?<p role="status">Loading chapter...</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(attempt+1)}>Retry</button></div>:text.split(/\n\s*\n/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
    </div>
  </section>;
}
