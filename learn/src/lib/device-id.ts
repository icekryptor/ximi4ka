// learn/src/lib/device-id.ts
//
// Single source of truth for the per-browser device id.
//
// Why this is subtle:
//   - The QR-code login (/kit-login) generates a UUID server-side and writes it
//     to BOTH the `xim_device_id` cookie AND the `user_devices` table.
//   - Before this file was fixed, getDeviceId() read localStorage *first*. If a
//     stale UUID sat in localStorage (because the user had visited any auth
//     page on this device before), the client would overwrite the freshly-set
//     server cookie with the stale value. Middleware then saw a device_id that
//     wasn't in `user_devices` for this user and force-signed-out → bounce to
//     /login with ?error=device_removed. Successful QR login appeared to fail.
//
// Rule: **the cookie wins**. If a cookie exists, mirror it into localStorage.
// Only if neither cookie nor localStorage has a value do we generate a new UUID.
const KEY = "xim_device_id";

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + KEY + "=([^;]+)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(id: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const cookieId = readCookie();
  const storageId = localStorage.getItem(KEY);

  // 1) Cookie wins. If cookie exists, treat it as authoritative.
  //    This handles the post-/kit-login case where the server set a UUID and
  //    inserted a matching row in user_devices — we must NOT clobber it.
  if (cookieId) {
    if (storageId !== cookieId) {
      localStorage.setItem(KEY, cookieId);
    }
    return cookieId;
  }

  // 2) No cookie but localStorage has one → mirror into cookie so middleware
  //    can read it server-side.
  if (storageId) {
    writeCookie(storageId);
    return storageId;
  }

  // 3) Nothing anywhere → generate fresh.
  const fresh = crypto.randomUUID();
  localStorage.setItem(KEY, fresh);
  writeCookie(fresh);
  return fresh;
}

export function clearDeviceId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  document.cookie = `${KEY}=; path=/; max-age=0`;
}
