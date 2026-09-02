import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to open this file." }, { status: 401 });
  }

  const { data: file, error } = await supabase
    .from("submission_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "This file could not be found for your account." }, { status: 404 });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("chapter-drafts")
    .createSignedUrl(file.storage_path, 60, {
      download: file.file_name
    });

  if (signedUrlError || !signedUrl?.signedUrl) {
    return NextResponse.json({ error: "ChapterFlow could not create a secure file link." }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
