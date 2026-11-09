import { ChapterFlowApp } from "@/components/chapterflow-app";
import { createClient } from "@/lib/supabase/server";

type BookRole = "admin" | "facilitator" | "author";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata.full_name as string | undefined) ?? (user?.user_metadata.name as string | undefined);

  let userRole: BookRole | null = null;
  let profileName = userName ?? null;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();

    if (profile?.role === "editor" || profile?.role === "admin") {
      userRole = "admin";
    } else if (profile?.role === "facilitator" || profile?.role === "author") {
      userRole = profile.role;
    } else {
      const { data: createdProfile } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name: userName ?? "New contributor",
          email: user.email ?? "",
          role: "author"
        })
        .select("role")
        .maybeSingle();

      userRole = createdProfile?.role === "facilitator" ? "facilitator" : "author";
    }

    profileName = profile?.full_name ?? userName ?? "New contributor";
  }

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: chapters } = await supabase
    .from("chapters")
    .select("*, profiles:author_id(full_name, email), submissions(*, submission_files(*)), reviews(*), peer_review_files(*)")
    .order("created_at", { ascending: false });
  const { data: peerReviewSettings, error: peerReviewSettingsError } = await supabase
    .from("peer_review_settings")
    .select("*")
    .order("created_at", { ascending: true });
  const { data: peerReviewAssignments, error: peerReviewAssignmentsError } = await supabase
    .from("peer_review_assignments")
    .select("*, reviewer:reviewer_id(full_name, email), chapter:chapter_id(id, book_id, title, abstract, proposal_outline, stage, status, current_deadline, created_at, profiles:author_id(full_name, email), submissions(*, submission_files(*)), peer_review_files(*)), peer_reviews(*)")
    .order("created_at", { ascending: true });
  const { data: bookAgreements } = await supabase
    .from("book_agreements")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: agreementAcceptances } = await supabase
    .from("agreement_acceptances")
    .select("*, profiles:author_id(full_name, email), chapters:chapter_id(title)")
    .order("accepted_at", { ascending: false });
  const { data: isSuperAdmin } = await supabase.rpc("is_admin");
  const { data: projectMembers } = await supabase.from("project_members").select("book_id, user_id, role, profiles:user_id(full_name, email)");
  const { data: magazineIssues } = await supabase.from("magazine_issues").select("*").order("created_at", { ascending: false });
  const ownMemberships = (projectMembers ?? []).filter((member) => member.user_id === user?.id);
  userRole = isSuperAdmin || ownMemberships.some((member) => member.role === "admin") ? "admin" : ownMemberships.some((member) => member.role === "facilitator") ? "facilitator" : user ? "author" : null;

  return (
    <ChapterFlowApp
      userEmail={user?.email}
      userName={profileName}
      userRole={userRole}
      peerReviewSettingsError={peerReviewSettingsError?.message ?? peerReviewAssignmentsError?.message}
      isSuperAdmin={Boolean(isSuperAdmin)}
      userId={user?.id}
      projectMembers={projectMembers ?? []}
      magazineIssues={magazineIssues ?? []}
      books={books ?? []}
      chapters={chapters ?? []}
      peerReviewSettings={peerReviewSettings ?? []}
      peerReviewAssignments={peerReviewAssignments ?? []}
      bookAgreements={bookAgreements ?? []}
      agreementAcceptances={agreementAcceptances ?? []}
    />
  );
}
