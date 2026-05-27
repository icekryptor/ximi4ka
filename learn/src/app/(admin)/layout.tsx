export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

const adminNav = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/modules", label: "Модули" },
  { href: "/admin/oge-tasks", label: "Задания ОГЭ" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/users", label: "Ученики" },
  { href: "/admin/achievements", label: "Достижения" },
  { href: "/admin/kits", label: "Партии наборов" },
  { href: "/admin/orders", label: "Заказы наборов" },
  { href: "/admin/payments-test", label: "Тест платежей" },
  { href: "/admin/chem-reactions", label: "Все реакции (док)" },
  { href: "/admin/chem-builder", label: "Конструктор реакций" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-text-primary text-white p-6 flex flex-col">
        <Link href="/admin" className="text-xl font-bold text-primary mb-8 block">
          XimiLearn Admin
        </Link>
        <nav className="space-y-2 flex-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <AdminLogoutButton />
      </aside>
      <main className="flex-1 bg-bg-secondary text-text-primary p-8">{children}</main>
    </div>
  );
}
