"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/projects", label: "Projects" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-of-neutral-200 bg-white">
      <div className="border-b border-of-neutral-200 px-4 py-4">
        <Link href="/projects" className="text-lg font-semibold text-of-primary-700">
          OpenFeedback
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-of px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-of-primary-50 text-of-primary-700"
                  : "text-of-neutral-600 hover:bg-of-neutral-100 hover:text-of-neutral-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
