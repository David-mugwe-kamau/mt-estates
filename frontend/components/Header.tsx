"use client";

import { useState, useEffect } from "react";
import { isLoggedIn, getUser, logout } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rentals", label: "For Rent" },
  { href: "/airbnbs", label: "Airbnbs" },
  { href: "/for-sale", label: "For Sale" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  function syncAuth() {
    const user = getUser<{ name: string; avatar_url?: string | null }>();
    setLoggedIn(isLoggedIn());
    setUserName(user?.name ?? "");
    setAvatarUrl(user?.avatar_url ?? null);
  }

  useEffect(() => {
    syncAuth();
    window.addEventListener("mt_auth_change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("mt_auth_change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="relative h-9 w-9 overflow-hidden rounded">
            <img
              src="/images/mt-estates-logo.png"
              alt="MT Estates logo"
              className="h-9 w-9 object-contain"
            />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-mt-blue">
            MT Estates
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-mt-orange">
              {link.label}
            </a>
          ))}

          {loggedIn ? (
            <>
              <a
                href="/dashboard"
                className="hover:text-mt-orange"
              >
                Dashboard
              </a>
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-mt-blue/20"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mt-blue/10 text-xs font-bold text-mt-blue uppercase">
                    {userName.charAt(0)}
                  </div>
                )}
                <span className="text-slate-700 text-sm font-medium">{userName.split(" ")[0]}</span>
                <button
                  onClick={logout}
                  className="text-xs text-slate-400 hover:text-red-500 ml-1"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <a
                href="/auth/register"
                className="text-slate-600 hover:text-mt-orange"
              >
                Register
              </a>
              <a
                href="/auth/login"
                className="rounded-full border border-mt-blue px-4 py-1.5 text-mt-blue shadow-sm transition hover:bg-mt-blue hover:text-white"
              >
                Login
              </a>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col items-center justify-center gap-1.5 p-2 md:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-6 bg-slate-700 transition-all duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-6 bg-slate-700 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-slate-700 transition-all duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-3 pt-3 text-sm font-medium text-slate-700">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-mt-orange"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}

            {loggedIn ? (
              <>
                <a
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-mt-orange"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </a>
                <div className="flex items-center gap-3 px-3 py-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mt-blue/10 text-xs font-bold text-mt-blue uppercase">
                      {userName.charAt(0)}
                    </div>
                  )}
                  <span className="text-slate-700">{userName}</span>
                  <button onClick={logout} className="ml-auto text-xs text-red-500">Logout</button>
                </div>
              </>
            ) : (
              <>
                <a
                  href="/auth/register"
                  className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-mt-orange"
                  onClick={() => setMenuOpen(false)}
                >
                  Register
                </a>
                <a
                  href="/auth/login"
                  className="mt-1 rounded-full border border-mt-blue px-4 py-2 text-center text-mt-blue transition hover:bg-mt-blue hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </a>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
