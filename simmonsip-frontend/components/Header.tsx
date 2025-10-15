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
    <header className="w-full bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <Logo />
          </Link>

          {/* Navigation */}
          <nav>
            <ul className="flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${
                          isActive
                            ? "bg-green-600 text-white shadow-sm"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
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
