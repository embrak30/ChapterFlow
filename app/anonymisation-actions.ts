"use server";

import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function authorisedSource(fileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const { data: file } = await supabase.from("submission_files").select("storage_path, file_name, submission_id").eq("id", fileId).single();
  if (!file) throw new Error("The original file could not be found.");
  const { data: submission } = await supabase.from("submissions").select("chapter_id").eq("id", file.submission_id).single();
  if (!submission) throw new Error("The chapter could not be found.");
  const { data: chapter } = await supabase.from("chapters").select("id, book_id").eq("id", submission.chapter_id).single();
  if (!chapter) throw new Error("The chapter could not be found.");
  const { data: allowed } = await supabase.rpc("can_edit_project", { b: chapter.book_id });
  if (!allowed) throw new Error("Only this project's editor can prepare review copies.");
  return { supabase, user, file, chapter };
}

export async function loadDraftForAnonymisation(fileId: string) {
  const { supabase, file } = await authorisedSource(fileId);
  if (!file.file_name.toLowerCase().endsWith(".docx")) throw new Error("The editor supports .docx files. For older .doc files, use the manual review-copy upload.");
  const { data, error } = await supabase.storage.from("chapter-drafts").download(file.storage_path);
  if (error || !data) throw new Error("Unable to open the original Word file.");
  if (data.size > 20 * 1024 * 1024) throw new Error("This document is too large to edit here.");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(await data.arrayBuffer()) });
  if (!result.value.trim()) throw new Error("No editable text was found in this document.");
  if (result.value.length > 500000) throw new Error("This document is too long to edit here.");
  return { text: result.value };
}

export async function saveAnonymisedText(fileId: string, text: string) {
  const { supabase, user, chapter } = await authorisedSource(fileId);
  if (!text.trim() || text.length > 500000) throw new Error("Enter a review copy of up to 500,000 characters.");
  // Rebuild a clean file so source comments, revisions and metadata are not carried over.
  const document = new Document({ creator: "ChapterFlow", title: "Anonymised review copy", sections: [{ children: text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })] })) }] });
  const buffer = await Packer.toBuffer(document);
  const fileName = "anonymised-review-copy.docx";
  const path = `${chapter.book_id}/${chapter.id}/peer-review/${crypto.randomUUID()}.docx`;
  const { error: uploadError } = await supabase.storage.from("chapter-drafts").upload(path, buffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from("peer_review_files").insert({ book_id: chapter.book_id, chapter_id: chapter.id, uploaded_by: user.id, storage_path: path, file_name: fileName, content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", byte_size: buffer.length, status: "approved", notes: "Editor prepared and approved an anonymised text copy inside ChapterFlow." });
  if (error) {
    await supabase.storage.from("chapter-drafts").remove([path]);
    throw new Error(error.message);
  }
  revalidatePath("/");
}
