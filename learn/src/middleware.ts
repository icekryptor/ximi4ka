import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip middleware for:
  //   – Next internals (_next/static, _next/image, favicon)
  //   – Static assets by extension (img, font, css, js, html, json, map, etc.)
  //
  // The extension list matters: before this fix, anonymous requests to
  // /tools/oge-lab.html and /tools/chem-predictions.json (both real files
  // in public/tools/) went through updateSession() → isProtectedPath returns
  // true for /tools/* → 307 redirect to /login. The iframe in
  // /learn/tools/lab loads these via in-page fetch, and on iOS Safari the
  // iframe sub-request occasionally lost cookies (ITP / private mode) →
  // user saw a blank trainer.
  //
  // Static files in public/ are public by definition — they should NEVER
  // hit auth middleware regardless of cookie state.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|html|json|js|css|map|woff|woff2|ttf|otf|mp3|mp4|webm|wav|ogg|pdf|txt|xml)$).*)",
  ],
};
