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

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

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
  }

  return <ChapterFlowApp userEmail={user?.email} userName={userName} userRole={userRole} />;
}
