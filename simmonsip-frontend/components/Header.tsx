"use client";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Header() {
  return (
    <header className="w-full flex justify-center items-start pt-6 px-4 relative">
      {/* Hamburger + dropdown wrapper */}
      <div className="absolute left-4 top-6 group">
        <button aria-label="Menu" className="text-2xl select-none pointer-events-auto">
          ☰
        </button>
        {/* Dropdown appears on hover */}
        <nav className="absolute top-6 left-0 mt-2 bg-white border border-gray-200 shadow rounded p-2 text-xs hidden group-hover:block">
          <ul className="space-y-1">
            <li>
              <Link href="/" className="block px-2 py-1 hover:bg-gray-100 whitespace-nowrap">
                Home
              </Link>
            </li>
            <li>
              <Link href="/competitors" className="block px-2 py-1 hover:bg-gray-100 whitespace-nowrap">
                Competitors
              </Link>
            </li>
            <li>
              <Link href="/keywords" className="block px-2 py-1 hover:bg-gray-100 whitespace-nowrap">
                Keywords
              </Link>
            </li>
            <li>
              <Link href="/images" className="block px-2 py-1 hover:bg-gray-100 whitespace-nowrap">
                Images
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Centered logo */}
      <Link href="/" className="pointer-events-auto">
        <Logo />
      </Link>
    </header>
  );
}
