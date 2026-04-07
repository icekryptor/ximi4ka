import { Header } from "@/components/layout/Header";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg-light">{children}</main>
    </>
  );
}
