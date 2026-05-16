import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Send } from "lucide-react";

type Theme = "light" | "dark";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tgHref(handle: string): string {
  const cleaned = handle.replace(/^@/, "").trim();
  if (cleaned.startsWith("http")) return cleaned;
  return `https://t.me/${cleaned}`;
}

export async function ProfilePreview({ theme = "light" }: { theme?: Theme }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, telegram")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name && !profile.display_name.startsWith("ximi-")
      ? profile.display_name
      : (user.email && !user.email.endsWith("@kits.ximi4ka.ru")
          ? user.email.split("@")[0]
          : "Без имени");
  const tg = profile?.telegram?.trim();
  const avatar = profile?.avatar_url?.trim();

  const isDark = theme === "dark";
  const wrapCls = isDark
    ? "border-white/10 hover:border-primary/40 bg-white/[0.03] hover:bg-white/[0.06]"
    : "border-border hover:border-primary/40 bg-white hover:bg-bg-tertiary";
  const nameCls = isDark ? "text-dark-text" : "text-text-primary";
  const tgCls = isDark ? "text-dark-text-muted" : "text-text-muted";

  return (
    <div className="flex items-center gap-2">
      {tg && (
        <a
          href={tgHref(tg)}
          target="_blank"
          rel="noopener noreferrer"
          className={`hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${tgCls} hover:text-primary`}
          title={`Telegram: ${tg}`}
        >
          <Send className="w-3 h-3" />
          <span className="font-medium">{tg.startsWith("@") ? tg : "@" + tg.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")}</span>
        </a>
      )}
      <Link
        href="/profile"
        className={`group flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border transition-all ${wrapCls}`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-gradient-start to-primary-gradient-end text-white text-[11px] font-bold flex items-center justify-center">
            {initials(displayName)}
          </span>
        )}
        <span className={`text-sm font-semibold max-w-[140px] truncate ${nameCls}`}>
          {displayName}
        </span>
      </Link>
    </div>
  );
}
