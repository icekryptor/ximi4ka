import Link from "next/link";

// Public-page footer. Includes legal requisites of the operator
// (ИП Аистов В.А.) and links to the canonical privacy policy & offer
// hosted on the marketing site ximi4ka.ru. The legal documents live on the
// parent site by design — single source of truth for both learn.* and root
// ximi4ka.ru.

const REQUISITES = {
  entity: "ИП Аистов Василий Андреевич",
  inn: "431401950080",
  ogrnip: "319435000027879",
  address: "г. Москва, 3-я Мытищинская ул., д. 16, стр. 21Б",
} as const;

const CONTACTS = {
  email: "info@ximi4ka.ru",
  phone: "+7 985 993-83-11",
  tg: "https://t.me/ximi4ka_support",
} as const;

// Legal docs MUST live on learn.ximi4ka.ru (this domain) — Yandex Pay merchant
// onboarding requires policy + offer to be hosted on the same domain that
// processes payments. /policy and /oferta are the canonical versions for this
// domain; ximi4ka.ru hosts its own separate copies for physical kit sales.
const DOCS = [
  { label: "Политика конфиденциальности", href: "/policy" },
  { label: "Публичная оферта", href: "/oferta" },
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto bg-white border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        {/* Three-column grid for legal info. Stacks on mobile. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          {/* Реквизиты */}
          <div className="space-y-1.5 text-text-secondary">
            <p className="font-semibold text-text-primary mb-2">Реквизиты</p>
            <p>{REQUISITES.entity}</p>
            <p>ИНН: <span className="tabular-nums">{REQUISITES.inn}</span></p>
            <p>ОГРНИП: <span className="tabular-nums">{REQUISITES.ogrnip}</span></p>
            <p>{REQUISITES.address}</p>
          </div>

          {/* Контакты */}
          <div className="space-y-1.5 text-text-secondary">
            <p className="font-semibold text-text-primary mb-2">Контакты</p>
            <p>
              <a
                href={`mailto:${CONTACTS.email}`}
                className="hover:text-primary transition-colors"
              >
                {CONTACTS.email}
              </a>
            </p>
            <p>
              <a
                href={`tel:${CONTACTS.phone.replace(/[\s-]/g, "")}`}
                className="hover:text-primary transition-colors tabular-nums"
              >
                {CONTACTS.phone}
              </a>
            </p>
            <p>
              <a
                href={CONTACTS.tg}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Telegram-поддержка
              </a>
            </p>
          </div>

          {/* Документы — все на нашем домене (требование Яндекс Пэй) */}
          <div className="space-y-1.5 text-text-secondary">
            <p className="font-semibold text-text-primary mb-2">Документы</p>
            {DOCS.map((d) => (
              <p key={d.href}>
                <Link
                  href={d.href}
                  className="hover:text-primary transition-colors"
                >
                  {d.label}
                </Link>
              </p>
            ))}
            <p>
              <Link
                href="/pricing"
                className="hover:text-primary transition-colors"
              >
                Тарифы и условия
              </Link>
            </p>
            <p>
              <Link
                href="/support"
                className="hover:text-primary transition-colors"
              >
                Помощь и поддержка
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom row — copyright + canonical site */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
          <p>© 2026 Ximi4ka. Все права защищены.</p>
          <p>
            <a
              href="https://ximi4ka.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              ximi4ka.ru
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
