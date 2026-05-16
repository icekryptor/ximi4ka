// learn/src/lib/device-id.ts
const KEY = "xim_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  // Mirror to cookie for server-side middleware reads
  document.cookie = `${KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}

export function clearDeviceId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  document.cookie = `${KEY}=; path=/; max-age=0`;
}
