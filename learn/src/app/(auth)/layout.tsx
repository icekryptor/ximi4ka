import { PixelIcon } from "@/components/ui/PixelIcon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bg-dark flex items-center justify-center p-4 overflow-hidden">
      {/* Radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,110,254,0.15)_0%,transparent_70%)]" />

      {/* Floating pixel decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <PixelIcon name="flask" size={40} className="absolute top-[10%] left-[15%] text-primary/25 animate-float" />
        <PixelIcon name="atom" size={32} className="absolute top-[20%] right-[20%] text-neon-cyan/25 animate-float-slow" />
        <PixelIcon name="star" size={28} className="absolute bottom-[15%] left-[25%] text-neon-lime/25 animate-float-fast" />
      </div>

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
