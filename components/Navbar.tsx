"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Trenchopoly Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-2xl font-semibold text-black">
              Trenchopoly
            </span>
          </Link>
          <div className="flex items-center gap-6">
            {isHomePage && (
              <a
                href="https://twitter.com/trenchopoly_fun"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
            <Link
              href="/lobby"
              className="text-gray-600 hover:text-black transition-colors font-medium"
            >
              Lobby
            </Link>
            <Link
              href="/market"
              className="text-gray-600 hover:text-black transition-colors font-medium"
            >
              Marketplace
            </Link>
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
