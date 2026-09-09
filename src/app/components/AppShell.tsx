"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaColumns, FaCog } from "react-icons/fa";

const NAV = [
  { href: "/", label: "Pipeline", icon: FaColumns },
  { href: "/settings", label: "Settings", icon: FaCog },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 px-2">
          <Image
            src="/logos/full-color.png"
            alt="Reforma Dental"
            width={36}
            height={36}
            priority
          />
          <span className="font-subhead font-semibold text-xs text-neutral-500 tracking-wide uppercase">
            CRM
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-brand text-brand-ink"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
