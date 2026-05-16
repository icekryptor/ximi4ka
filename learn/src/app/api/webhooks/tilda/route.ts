import { NextRequest, NextResponse } from "next/server";
import { assignNextCredential, adminClient } from "@/lib/kit-assignment";

async function logWebhook(
  payload: unknown,
  contentType: string,
  httpStatus: number,
  response: unknown,
) {
  try {
    const admin = adminClient();
    await admin.from("webhook_log").insert({
      source: "tilda",
      content_type: contentType,
      payload: payload as never,
      http_status: httpStatus,
      response: response as never,
    });
  } catch (e) {
    console.error("webhook_log insert failed:", e);
  }
}

/**
 * Tilda webhook receiver.
 *
 * Tilda sends form submissions as either application/x-www-form-urlencoded
 * or application/json depending on integration settings. We accept both.
 *
 * Only orders containing the OGE kit SKU (default: 7OGE26, overridable via
 * REQUIRED_SKU env or `?sku=` query param) get assigned credentials.
 * Orders without the SKU are returned as 200 OK with `skipped: true`.
 *
 * Auth: shared secret in the URL query string `?token=...`. Tilda allows
 * arbitrary query params in webhook URLs and is the standard auth method.
 *
 * Returns JSON:
 *   - { login, password, qr_link, batch_id, ... } on successful assignment
 *   - { skipped: true, reason: "no_oge_kit", ... } if SKU not in order
 *   - { ok: true, test: true } for Tilda's test ping
 */

const DEFAULT_REQUIRED_SKU = "7OGE26";

// Walk a payload (mix of objects, arrays, scalars) and return all SKU strings
// found anywhere. Handles both nested JSON (payment.products[].sku) and
// Tilda's flattened form-encoded keys like "payment[products][0][sku]".
function extractSkus(payload: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const skuLikeKey = (k: string) =>
    /\b(sku|article|articul|артикул)\b/i.test(k);

  // Flat form-encoded keys: scan keys themselves
  for (const [key, val] of Object.entries(payload)) {
    if (skuLikeKey(key) && typeof val === "string" && val.trim()) {
      found.add(val.trim());
    }
  }

  // Recursive walk for nested JSON (e.g. payment.products[].sku)
  function walk(node: unknown) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (skuLikeKey(key) && typeof val === "string" && val.trim()) {
        found.add(val.trim());
      }
      walk(val);
    }
  }
  walk(payload);

  return Array.from(found);
}
export async function POST(request: NextRequest) {
  const secret = process.env.TILDA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("TILDA_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const token = request.nextUrl.searchParams.get("token");
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body — Tilda may send JSON or form-encoded
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const form = await request.formData();
      form.forEach((v, k) => { payload[k] = v.toString(); });
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Tilda sends "test" pings when you save the integration — acknowledge & exit
  if (payload.test === "test" || payload.test === true) {
    return NextResponse.json({ ok: true, test: true });
  }

  // Recursive lookup: finds the first matching key anywhere in payload tree.
  // `skipSubtrees` regex of key names whose contents we should NOT search
  // (e.g. when looking for buyer's name, avoid descending into `products` array
  // where each item also has a `name` field — that's the product name).
  const findValue = (
    keys: string[],
    opts: { skipSubtrees?: RegExp } = {},
  ): string | null => {
    const lowerWanted = keys.map((k) => k.toLowerCase());
    const skip = opts.skipSubtrees;
    function normalizeKey(k: string): string {
      const segs = k.split(/[.\[\]]+/).filter(Boolean);
      return (segs[segs.length - 1] ?? k).toLowerCase();
    }
    function walk(node: unknown, currentKey?: string): string | null {
      if (skip && currentKey && skip.test(currentKey)) return null;
      if (!node) return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const r = walk(item, currentKey);
          if (r) return r;
        }
        return null;
      }
      if (typeof node !== "object") return null;
      // Check this level first (BFS-like for top-level matches)
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (lowerWanted.includes(normalizeKey(key)) && typeof val === "string" && val.trim()) {
          return val.trim();
        }
      }
      // Then recurse
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        const r = walk(val, key);
        if (r) return r;
      }
      return null;
    }
    return walk(payload);
  };

  // Skip product/item arrays when extracting buyer info (their `name`/`Name` is product name)
  const SKIP_PRODUCTS = /^(products|items|cart|goods|orders|товары|корзина)$/i;
  const name = findValue(
    [
      // Tilda standard buyer-name fields (members area + delivery)
      "ma_name", "delivery_fio",
      // Custom form fields
      "full name", "full_name", "fullname", "Full Name", "FullName",
      "fio", "ФИО", "Имя",
      "Name", "name",
    ],
    { skipSubtrees: SKIP_PRODUCTS },
  );
  const telegram = findValue(
    ["Telegram", "telegram", "tg", "Телеграм", "telegram_username"],
    { skipSubtrees: SKIP_PRODUCTS },
  );
  const orderId = findValue(["orderid", "order_id", "payment_orderid"]) ?? null;
  const moduleSlug = findValue(["module"], { skipSubtrees: SKIP_PRODUCTS }) ?? "oge";

  // Log incoming payload structure (keys only, no values) for debugging real Tilda
  // payloads. Strip during stable operation if logs get noisy.
  try {
    const summarize = (obj: unknown, depth = 0): unknown => {
      if (depth > 3 || obj === null) return obj === null ? null : typeof obj;
      if (Array.isArray(obj)) return obj.slice(0, 2).map(x => summarize(x, depth + 1));
      if (typeof obj !== "object") return typeof obj;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[k] = summarize(v, depth + 1);
      }
      return out;
    };
    console.log("[tilda-webhook] payload structure:", JSON.stringify(summarize(payload)).slice(0, 1500));
    console.log("[tilda-webhook] extracted:", { name, telegram, orderId, moduleSlug });
  } catch {}

  // SKU filter: order must contain the OGE kit (default 7OGE26).
  // Override via ?sku= query param or REQUIRED_SKU env (case-insensitive).
  const requiredSku = (
    request.nextUrl.searchParams.get("sku") ??
    process.env.REQUIRED_SKU ??
    DEFAULT_REQUIRED_SKU
  ).toLowerCase();
  const orderSkus = extractSkus(payload);
  const hasRequiredSku = orderSkus.some((s) => s.toLowerCase() === requiredSku);
  if (!hasRequiredSku) {
    const resp = {
      skipped: true,
      reason: "no_oge_kit",
      required_sku: requiredSku.toUpperCase(),
      order_skus: orderSkus,
      external_order_id: orderId,
    };
    await logWebhook(payload, contentType, 200, resp);
    return NextResponse.json(resp);
  }

  if (!name) {
    const resp = { error: "Missing 'Name' field" };
    await logWebhook(payload, contentType, 400, resp);
    return NextResponse.json(resp, { status: 400 });
  }

  // Idempotency: if external_order_id was already processed, return existing assignment
  if (orderId) {
    const admin = adminClient();
    const { data: existing } = await admin
      .from("kit_credentials")
      .select("login, password_plain, batch_id, external_order_id")
      .eq("external_order_id", orderId)
      .maybeSingle();
    if (existing) {
      const pwd = existing.password_plain ?? "";
      const qr = pwd
        ? `https://learn.ximi4ka.ru/kit-login?l=${encodeURIComponent(existing.login)}&p=${encodeURIComponent(pwd)}`
        : null;
      const resp = {
        login: existing.login,
        password: pwd,
        qr_link: qr,
        batch_id: existing.batch_id,
        external_order_id: existing.external_order_id,
        duplicate: true,
      };
      await logWebhook(payload, contentType, 200, resp);
      return NextResponse.json(resp);
    }
  }

  try {
    const assignment = await assignNextCredential({
      moduleSlug,
      name,
      telegram,
      externalOrderId: orderId,
    });
    await logWebhook(payload, contentType, 200, assignment);
    return NextResponse.json(assignment);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("tilda webhook failed:", msg);
    const resp = { error: msg };
    await logWebhook(payload, contentType, 500, resp);
    return NextResponse.json(resp, { status: 500 });
  }
}
