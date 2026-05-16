import { createClient as createSupabase, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role helpers for assigning kit credentials to incoming orders.
 *
 * - `assignNextCredential` reserves the oldest unassigned credential in a
 *   batch and updates the linked profile with the buyer's display_name +
 *   telegram so the avatar/profile preview shows their info on first login.
 * - When the pool is empty, auto-generates a fresh credential in the most
 *   recent batch for the given module so orders never wait.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PROD_HOST = "https://learn.ximi4ka.ru";

function randomCode(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function genLogin(): string {
  return `ximi-${randomCode(6)}`;
}
function genPassword(): string {
  return `${randomCode(4)}-${randomCode(4)}`;
}

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Assignment = {
  login: string;
  password: string;
  qr_link: string;
  batch_id: string;
  external_order_id: string | null;
  fresh: boolean; // true if auto-generated (pool was empty)
};

/**
 * Find oldest unassigned + still-active credential for the given module.
 * If none available, create a fresh one in the latest batch for that module.
 */
export async function assignNextCredential(opts: {
  moduleSlug: string;
  name: string;
  telegram?: string | null;
  externalOrderId?: string | null;
}): Promise<Assignment> {
  const admin = adminClient();

  // Look up module
  const { data: mod, error: modErr } = await admin
    .from("modules")
    .select("id")
    .eq("slug", opts.moduleSlug)
    .single();
  if (modErr || !mod) throw new Error(`Module "${opts.moduleSlug}" not found`);

  // Find latest batch for this module (most recent — also used for auto-gen)
  const { data: latestBatch, error: batchErr } = await admin
    .from("kit_batches")
    .select("id, duration_days")
    .eq("module_id", mod.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batchErr) throw new Error("Failed to look up kit_batches");

  // Try to find oldest unassigned credential in any batch for this module
  const { data: pool, error: poolErr } = await admin
    .from("kit_credentials")
    .select("id, login, password_plain, supabase_user_id, batch_id, kit_batches!inner(module_id)")
    .eq("kit_batches.module_id", mod.id)
    .is("assigned_at", null)
    .eq("is_disabled", false)
    .not("password_plain", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (poolErr) throw new Error("Failed to query pool");

  let cred:
    | { id: string; login: string; password_plain: string; supabase_user_id: string; batch_id: string }
    | null = null;
  let fresh = false;

  if (pool && pool.length > 0) {
    const p = pool[0] as {
      id: string;
      login: string;
      password_plain: string;
      supabase_user_id: string;
      batch_id: string;
    };
    cred = p;
  } else {
    // Auto-generate a new credential in the latest batch
    if (!latestBatch) throw new Error(`No batches exist for module "${opts.moduleSlug}"`);
    const login = genLogin();
    const password = genPassword();
    const email = `${login}@kits.ximi4ka.ru`;
    const { data: createUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { kit_login: login, batch_id: latestBatch.id, auto_generated: true },
    });
    if (createErr || !createUser?.user) {
      throw new Error("Failed to create auth user: " + (createErr?.message ?? "unknown"));
    }
    const { data: inserted, error: insErr } = await admin
      .from("kit_credentials")
      .insert({
        batch_id: latestBatch.id,
        login,
        password_plain: password,
        supabase_user_id: createUser.user.id,
      })
      .select("id, login, password_plain, supabase_user_id, batch_id")
      .single();
    if (insErr || !inserted) {
      throw new Error("Failed to insert kit_credentials: " + (insErr?.message ?? "unknown"));
    }
    cred = inserted as unknown as typeof cred;
    fresh = true;
  }

  if (!cred) throw new Error("No credential available");

  // Mark as assigned
  const { error: updErr } = await admin
    .from("kit_credentials")
    .update({
      assigned_at: new Date().toISOString(),
      assigned_name: opts.name,
      assigned_telegram: opts.telegram ?? null,
      external_order_id: opts.externalOrderId ?? null,
    })
    .eq("id", cred.id);
  if (updErr) throw new Error("Failed to mark assigned: " + updErr.message);

  // Pre-populate profile (the row was created by the handle_new_user trigger)
  await admin
    .from("profiles")
    .update({
      display_name: opts.name,
      telegram: opts.telegram ?? null,
    })
    .eq("id", cred.supabase_user_id);

  const qrLink = `${PROD_HOST}/kit-login?l=${encodeURIComponent(cred.login)}&p=${encodeURIComponent(cred.password_plain)}`;

  return {
    login: cred.login,
    password: cred.password_plain,
    qr_link: qrLink,
    batch_id: cred.batch_id,
    external_order_id: opts.externalOrderId ?? null,
    fresh,
  };
}
