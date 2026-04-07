import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center text-text-secondary text-sm">
        <p>&copy; {new Date().getFullYear()} Ximi4ka. Все права защищены.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="https://ximi4ka.ru" className="hover:text-primary transition-colors">
            ximi4ka.ru
          </Link>
        </div>
      </div>
    </footer>
  );
}
