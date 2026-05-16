/**
 * One-off importer: reads orders CSV and assigns a kit credential to each
 * paid order containing the OGE SKU (7OGE26).
 *
 * Skips: blocked orders, already-assigned orderids, rows with no name.
 * Outputs a result CSV with columns: name, telegram, orderid, status, login,
 * password, qr_link.
 *
 * Usage:
 *   npm run kits:import-csv -- --input=/path/to/source.csv --output=/path/to/result.csv
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PROD_HOST = "https://learn.ximi4ka.ru";
const REQUIRED_SKU = "7OGE26";

function randomCode(len: number): string {
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return out.join("");
}

function genLogin(): string { return `ximi-${randomCode(6)}`; }
function genPassword(): string { return `${randomCode(4)}-${randomCode(4)}`; }

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  argv.slice(2).forEach(arg => {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function pick(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]?.trim();
    if (v) return v;
  }
  return null;
}

function normalizeTelegram(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // Strip URL prefixes
  s = s.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  // Strip leading @
  s = s.replace(/^@+/, "");
  if (!s) return null;
  return "@" + s;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.output) {
    console.error("Usage: --input=source.csv --output=result.csv");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up OGE module
  const { data: mod } = await admin.from("modules").select("id").eq("slug", "oge").single();
  if (!mod) { console.error("Module 'oge' not found"); process.exit(1); }

  // Find latest batch for OGE — we'll auto-create new credentials in this batch if pool empty
  const { data: latestBatch } = await admin
    .from("kit_batches")
    .select("id, duration_days")
    .eq("module_id", mod.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestBatch) { console.error("No OGE batch exists; create one first"); process.exit(1); }

  // Parse input CSV
  const raw = readFileSync(args.input, "utf-8");
  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  });
  console.log(`Read ${rows.length} rows from ${args.input}`);

  // Filter: OGE product + status 'sent'
  const candidates = rows.filter(r => {
    const product = (r.product ?? "").toLowerCase();
    const status = (r.tilda_status ?? "").toLowerCase();
    return product.includes("7oge26") && status === "sent";
  });
  console.log(`${candidates.length} paid OGE orders`);

  // Dedup by orderid (Tilda webhook can fire multiple times)
  const seenOrders = new Set<string>();
  const unique = candidates.filter(r => {
    const oid = (r.tilda_orderid ?? "").trim();
    if (!oid) return true; // keep ones without orderid
    if (seenOrders.has(oid)) return false;
    seenOrders.add(oid);
    return true;
  });
  console.log(`${unique.length} unique orders after dedup`);

  // Fetch already-assigned orderids from DB to skip
  const { data: existing } = await admin
    .from("kit_credentials")
    .select("external_order_id")
    .not("external_order_id", "is", null);
  const assignedOrders = new Set((existing ?? []).map(r => r.external_order_id));
  console.log(`${assignedOrders.size} orders already in DB`);

  // Result rows
  const results: Record<string, string>[] = [];

  for (let i = 0; i < unique.length; i++) {
    const r = unique[i];
    const orderId = (r.tilda_orderid ?? "").trim() || null;
    const name = pick(r, "ma_name", "name") || (orderId ? `Заказ #${orderId}` : "Без имени");
    const telegram = normalizeTelegram(pick(r, "telegram", "ваш_логин_telegram"));

    // Skip if already assigned
    if (orderId && assignedOrders.has(orderId)) {
      console.log(`  [${i + 1}/${unique.length}] SKIP order ${orderId} (already assigned)`);
      // Look up existing assignment
      const { data: ex } = await admin
        .from("kit_credentials")
        .select("login, password_plain")
        .eq("external_order_id", orderId)
        .single();
      results.push({
        name, telegram: telegram ?? "", orderid: orderId,
        status: "already_assigned",
        login: ex?.login ?? "",
        password: ex?.password_plain ?? "",
        qr_link: ex?.password_plain
          ? `${PROD_HOST}/kit-login?l=${encodeURIComponent(ex.login)}&p=${encodeURIComponent(ex.password_plain)}`
          : "",
      });
      continue;
    }

    // Try to grab an unassigned credential
    const { data: pool } = await admin
      .from("kit_credentials")
      .select("id, login, password_plain, supabase_user_id, batch_id, kit_batches!inner(module_id)")
      .eq("kit_batches.module_id", mod.id)
      .is("assigned_at", null)
      .eq("is_disabled", false)
      .not("password_plain", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    let cred: { id: string; login: string; password_plain: string; supabase_user_id: string; batch_id: string };

    if (pool && pool.length > 0) {
      cred = pool[0] as unknown as typeof cred;
    } else {
      // Auto-generate in latest batch
      const login = genLogin();
      const password = genPassword();
      const email = `${login}@kits.ximi4ka.ru`;
      const { data: createUser, error: cuErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { kit_login: login, batch_id: latestBatch.id, auto_generated: true, import: true },
      });
      if (cuErr || !createUser?.user) {
        console.error(`  [${i + 1}/${unique.length}] FAIL create user: ${cuErr?.message}`);
        results.push({ name, telegram: telegram ?? "", orderid: orderId ?? "", status: "error_create_user", login: "", password: "", qr_link: "" });
        continue;
      }
      const { data: ins, error: insErr } = await admin
        .from("kit_credentials")
        .insert({ batch_id: latestBatch.id, login, password_plain: password, supabase_user_id: createUser.user.id })
        .select("id, login, password_plain, supabase_user_id, batch_id")
        .single();
      if (insErr || !ins) {
        console.error(`  [${i + 1}/${unique.length}] FAIL insert cred: ${insErr?.message}`);
        results.push({ name, telegram: telegram ?? "", orderid: orderId ?? "", status: "error_insert", login: "", password: "", qr_link: "" });
        continue;
      }
      cred = ins as unknown as typeof cred;
    }

    // Assign
    await admin.from("kit_credentials").update({
      assigned_at: new Date().toISOString(),
      assigned_name: name,
      assigned_telegram: telegram,
      external_order_id: orderId,
    }).eq("id", cred.id);

    await admin.from("profiles").update({
      display_name: name,
      telegram,
    }).eq("id", cred.supabase_user_id);

    if (orderId) assignedOrders.add(orderId);

    const qr = `${PROD_HOST}/kit-login?l=${encodeURIComponent(cred.login)}&p=${encodeURIComponent(cred.password_plain)}`;
    results.push({
      name, telegram: telegram ?? "", orderid: orderId ?? "",
      status: "assigned",
      login: cred.login, password: cred.password_plain, qr_link: qr,
    });
    console.log(`  [${i + 1}/${unique.length}] ${name} → ${cred.login}`);
  }

  const csvOut = stringify(results, { header: true, columns: ["name", "telegram", "orderid", "status", "login", "password", "qr_link"] });
  writeFileSync(args.output, csvOut, "utf-8");
  console.log(`\nWrote ${results.length} results to ${args.output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
