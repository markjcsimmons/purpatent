"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Trawl" },
    { href: "/competitors", label: "Competitors" },
    { href: "/keywords", label: "Keywords" },
    { href: "/images", label: "Images" },
  ];

  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Logo />
          </Link>

          {/* Navigation */}
          <nav>
            <ul className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        px-3 py-1.5 rounded text-xs font-medium transition-colors
                        ${
                          isActive
                            ? "bg-green-700 text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
