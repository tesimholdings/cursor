"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, ListFilter, Upload, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Pipeline", icon: LayoutDashboard },
  { href: "/ranking", label: "Rankings", icon: ListFilter },
  { href: "/upload", label: "Upload list", icon: Upload },
  { href: "/teams", label: "Teams", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--navy)] text-[#f7f1e4]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--brass)] text-[var(--navy)]">
              <Building2 size={18} />
            </span>
            <span>
              <span className="serif block text-[17px] leading-tight">Acquisition Command Center</span>
              <span className="text-[10px] tracking-[0.18em] uppercase text-[#c9bea8]">
                Next decision, not every decision
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                    active ? "bg-white/10" : "text-[#c9bea8] hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
