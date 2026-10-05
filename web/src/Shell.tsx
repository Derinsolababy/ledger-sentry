import { useEffect, useRef, useState, type ReactNode } from "react";

import { Link, useTitle } from "./lib/router";

const NAV = [
  ["/", "Home"],
  ["/app", "Dashboard"],
  ["/docs", "Docs"],
] as const;

const REPO = "https://github.com/Derinsolababy/ledger-sentry";

function HeaderAction() {
  return (
    <a className="btn btn-pri inline-block" href={REPO} target="_blank" rel="noreferrer">
      GitHub ↗
    </a>
  );
}

export function Shell({ route, children }: { route: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Close on navigation; Escape closes and hands focus back to the toggle.
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-coal/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span className="text-lg font-extrabold text-txt">ledger-sentry</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${route === to ? "bg-txt text-coal" : "text-sub hover:bg-slab hover:text-txt"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <HeaderAction />
          </div>
          <button className="btn btn-sec px-3 py-2 md:hidden" onClick={() => setOpen((v) => !v)} ref={toggleRef} aria-label="Menu" aria-controls="mobile-menu" aria-expanded={open}>
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div id="mobile-menu" ref={menuRef} className="space-y-1 border-t border-line px-5 py-4 md:hidden" onClick={() => setOpen(false)}>
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={`block rounded-lg px-3.5 py-2 text-sm font-semibold ${route === to ? "bg-txt text-coal" : "text-sub hover:bg-slab hover:text-txt"}`}>
                {label}
              </Link>
            ))}
            <div className="pt-2">
              <HeaderAction />
            </div>
          </div>
        )}
        
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-line bg-slab">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-extrabold text-txt">ledger-sentry</p>
            <p className="mt-2 max-w-xs text-sm text-sub">Alerts for Stellar accounts, delivered to Discord, Slack or any webhook.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-txt">Product</p>
            <ul className="mt-3 space-y-2 text-sub">
              <li><Link to="/app" className="hover:underline">Dashboard</Link></li>
              <li><Link to="/docs" className="hover:underline">Documentation</Link></li>
              <li><Link to="/docs/faq" className="hover:underline">FAQ</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-txt">Open source</p>
            <ul className="mt-3 space-y-2 text-sub">
              <li><a href={REPO} target="_blank" rel="noreferrer" className="hover:underline">GitHub</a></li>
              
              <li><a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="hover:underline">MIT license</a></li>
            </ul>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-sub opacity-80">Read-only monitoring of public ledger data on testnet and mainnet. No keys, ever.</p>
      </footer>
    </div>
  );
}

export function NotFound() {
  useTitle("Not found · ledger-sentry");
  return (
    <section className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="text-8xl font-extrabold tracking-tight text-live">404</p>
      <p className="mt-4 text-lg text-sub">There’s nothing at this address.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/" className="btn btn-pri inline-block">Back home</Link>
        <Link to="/docs" className="btn btn-sec inline-block">Read the docs</Link>
      </div>
    </section>
  );
}
