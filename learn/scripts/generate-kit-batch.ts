// learn/scripts/generate-kit-batch.ts
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { randomBytes } from "crypto";
import * as readline from "readline";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // base32 without 0/O/1/I/L

function randomCode(len: number): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

function genLogin(): string {
  return `ximi-${randomCode(6)}`;
}

function genPassword(): string {
  return `${randomCode(4)}-${randomCode(4)}`;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  argv.slice(2).forEach(arg => {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) {
      out[m[1]] = m[2];
    } else {
      const flagM = arg.match(/^--([^=]+)$/);
      if (flagM) out[flagM[1]] = true;
    }
  });
  return out;
}

async function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
}

function s(args: Record<string, string | boolean>, key: string): string {
  const v = args[key];
  if (typeof v !== "string") throw new Error(`Missing arg --${key}`);
  return v;
}

async function main() {
  const args = parseArgs(process.argv);
  const required = ["module", "count", "duration", "name", "output"];
  for (const k of required) {
    if (!args[k] || typeof args[k] !== "string") {
      console.error(`Missing required arg: --${k}`);
      console.error(`Usage: npx tsx scripts/generate-kit-batch.ts --module=oge --count=50 --duration=365 --name="OGE Batch 2026-05" --output=batch-001.csv [--clear-passwords]`);
      process.exit(1);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find module
  const { data: mod, error: modErr } = await supabase
    .from("modules")
    .select("id")
    .eq("slug", s(args, "module"))
    .single();
  if (modErr || !mod) {
    console.error(`Module with slug "${s(args, "module")}" not found`);
    process.exit(1);
  }

  // Create batch
  const { data: batch, error: batchErr } = await supabase
    .from("kit_batches")
    .insert({
      name: s(args, "name"),
      module_id: mod.id,
      count: parseInt(s(args, "count"), 10),
      duration_days: parseInt(s(args, "duration"), 10),
    })
    .select()
    .single();
  if (batchErr || !batch) {
    console.error("Failed to create batch:", batchErr);
    process.exit(1);
  }
  console.log(`Created batch: ${batch.id}`);

  // Generate credentials
  const count = parseInt(s(args, "count"), 10);
  const rows: string[] = ["Логин,Пароль,QR-ссылка"];
  for (let i = 0; i < count; i++) {
    const login = genLogin();
    const password = genPassword();
    const email = `${login}@kits.ximi4ka.ru`;

    const { data: createUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { kit_login: login, batch_id: batch.id },
    });
    if (createErr || !createUser?.user) {
      console.error(`Row ${i + 1}: failed to create user`, createErr);
      continue;
    }

    const { error: credErr } = await supabase.from("kit_credentials").insert({
      batch_id: batch.id,
      login,
      password_plain: password,
      supabase_user_id: createUser.user.id,
    });
    if (credErr) {
      console.error(`Row ${i + 1}: failed to insert kit_credentials`, credErr);
      continue;
    }

    const qrLink = `https://learn.ximi4ka.ru/kit-login?l=${encodeURIComponent(login)}&p=${encodeURIComponent(password)}`;
    rows.push(`${login},${password},${qrLink}`);
    if ((i + 1) % 10 === 0) console.log(`  Generated ${i + 1}/${count}`);
  }

  const outputPath = s(args, "output");
  writeFileSync(outputPath, rows.join("\n") + "\n", "utf-8");
  console.log(`\nWrote ${count} credentials to ${outputPath}`);

  // Passwords are kept in DB by default — needed for webhook /api/webhooks/tilda
  // which returns the kit-login URL containing the password.
  // Pass --clear-passwords to erase them from DB (CSV is the only artifact afterwards).
  if (args["clear-passwords"]) {
    const { error: clearErr } = await supabase
      .from("kit_credentials")
      .update({ password_plain: null })
      .eq("batch_id", batch.id);
    if (clearErr) console.error("Failed to clear passwords:", clearErr);
    else console.log("password_plain cleared (passed --clear-passwords).");
  } else {
    console.log("password_plain preserved in DB (use --clear-passwords to erase).");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
