"use client";

import { useRef, useState } from "react";
import { loadDraftForAnonymisation, saveAnonymisedText } from "@/app/anonymisation-actions";

export function AnonymisationEditor({ fileId }: { fileId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("[Name removed]");
  const [selected, setSelected] = useState({ start: 0, end: 0 });
  const [undo, setUndo] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [approved, setApproved] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  async function open() {
    setPending(true); setMessage("");
    try { setText((await loadDraftForAnonymisation(fileId)).text); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open the draft."); }
    finally { setPending(false); }
  }
  function replace(all: boolean) {
    if (text === null || selected.end <= selected.start || !replacement.trim()) return;
    const phrase = text.slice(selected.start, selected.end);
    const count = all ? text.split(phrase).length - 1 : 1;
    setUndo((history) => [...history.slice(-19), text]);
    setText(all ? text.replaceAll(phrase, replacement) : text.slice(0, selected.start) + replacement + text.slice(selected.end));
    setSelected({ start: 0, end: 0 }); setApproved(false);
    setMessage(`Replaced ${count} occurrence${count === 1 ? "" : "s"}.`);
  }
  async function save() {
    if (text === null || !approved) return;
    setPending(true); setMessage("");
    try { await saveAnonymisedText(fileId, text); setMessage("Anonymised Word copy saved and approved for peer review."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save the review copy."); }
    finally { setPending(false); }
  }
  return <section className="anonymisation-editor">
    {text === null ? <button type="button" disabled={pending} onClick={open}>{pending ? "Opening draft..." : "Edit anonymised copy in ChapterFlow"}</button> : <>
      <h3>Prepare anonymised review copy</h3>
      <p className="muted">Select text below and choose its replacement. This creates a text-based Word copy with paragraph breaks; images, complex tables and original styling are not retained. Check the complete text before approval.</p>
      <div className="anonymisation-toolbar">
        <label>Replacement<select value={replacement} onChange={(event) => setReplacement(event.target.value)}><option>[Name removed]</option><option>[School removed]</option><option>[Location removed]</option><option>[Organisation removed]</option></select></label>
        <label>Custom wording<input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
        <button type="button" disabled={pending || selected.end <= selected.start || !replacement.trim()} onClick={() => replace(false)}>Replace selected</button>
        <button type="button" disabled={pending || selected.end <= selected.start || !replacement.trim()} onClick={() => replace(true)}>Replace all exact matches</button>
        <button type="button" disabled={pending || !undo.length} onClick={() => { setText(undo[undo.length - 1]); setUndo(undo.slice(0, -1)); setApproved(false); setSelected({ start: 0, end: 0 }); }}>Undo replacement</button>
      </div>
      <textarea ref={editor} aria-label="Anonymised chapter text" value={text} disabled={pending} onSelect={(event) => setSelected({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} onChange={(event) => { setText(event.target.value); setApproved(false); }} />
      <label className="check-row"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /><span>I have checked this copy and approve it for blind peer review.</span></label>
      <button className="primary" type="button" disabled={pending || !approved || !text.trim()} onClick={save}>{pending ? "Saving..." : "Save and approve anonymised Word copy"}</button>
      <p className="muted">Changes are saved when you approve the copy. Keep this editor open until then.</p>
    </>}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
