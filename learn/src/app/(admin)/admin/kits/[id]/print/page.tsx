import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PrintLabelsClient } from "@/components/admin/PrintLabelsClient";

type Filter = "unassigned" | "assigned" | "all";

export default async function PrintLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const filter = ((sp.filter ?? "unassigned") as Filter);

  const { data: batch } = await supabase
    .from("kit_batches")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!batch) notFound();

  let query = supabase
    .from("kit_credentials")
    .select("id, login, password_plain, assigned_at, assigned_name")
    .eq("batch_id", id)
    .not("password_plain", "is", null)
    .order("login");

  if (filter === "unassigned") query = query.is("assigned_at", null);
  else if (filter === "assigned") query = query.not("assigned_at", "is", null);

  const { data: creds } = await query;

  const labels = (creds ?? []).map((c) => ({
    login: c.login,
    password: c.password_plain as string,
    assignedName: c.assigned_name as string | null,
    qrUrl: `https://learn.ximi4ka.ru/kit-login?l=${encodeURIComponent(c.login)}&p=${encodeURIComponent(c.password_plain as string)}`,
  }));

  return (
    <PrintLabelsClient
      batchName={batch.name}
      filter={filter}
      labels={labels}
    />
  );
}
