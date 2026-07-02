"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import clsx from "clsx";

// ── Icon components ──────────────────────────────────────────────
function NavIcon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg className={clsx("h-4 w-4 flex-shrink-0", active ? "text-brand-400" : "text-slate-500")}
      viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d={d} clipRule="evenodd" />
    </svg>
  );
}

const DashIcon  = ({ active }: { active: boolean }) => <NavIcon active={active} d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm8-3a3 3 0 100 6 3 3 0 000-6z" />;
const KitchenIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />;
const PosIcon   = ({ active }: { active: boolean }) => <NavIcon active={active} d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />;
const OrderIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" />;
const MenuIcon  = ({ active }: { active: boolean }) => <NavIcon active={active} d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />;
const BoxIcon   = ({ active }: { active: boolean }) => <NavIcon active={active} d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4zM3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />;
const TruckIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z M3 4a1 1 0 00-1 1v7a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H11a1 1 0 001-1V5a1 1 0 00-1-1H3zm11 3h-2v4h4.05a2.5 2.5 0 00-2.05-1V7z" />;
const ChartIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />;
const PnlIcon   = ({ active }: { active: boolean }) => <NavIcon active={active} d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />;
const CostIcon  = ({ active }: { active: boolean }) => <NavIcon active={active} d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V7h2v2z" />;
const StaffIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />;
const TableIcon  = ({ active }: { active: boolean }) => <NavIcon active={active} d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />;
const RecipeIcon = ({ active }: { active: boolean }) => <NavIcon active={active} d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />;

const NAV_SECTIONS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard",  label: "Dashboard",   icon: DashIcon   },
      { href: "/kitchen",    label: "Kitchen",      icon: KitchenIcon },
      { href: "/pos",        label: "POS",          icon: PosIcon    },
      { href: "/orders",     label: "Orders",       icon: OrderIcon  },
    ],
  },
  {
    label: "Menu & Stock",
    items: [
      { href: "/menu",       label: "Menu",         icon: MenuIcon   },
      { href: "/inventory",  label: "Inventory",    icon: BoxIcon    },
      { href: "/recipes",    label: "Recipes",      icon: RecipeIcon },
      { href: "/suppliers",  label: "Suppliers",    icon: TruckIcon  },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/reports",    label: "Reports",      icon: ChartIcon  },
      { href: "/pnl",        label: "P&L",          icon: PnlIcon    },
      { href: "/costs",      label: "Op. Costs",    icon: CostIcon   },
    ],
  },
  {
    label: "Team & Tables",
    items: [
      { href: "/staff",      label: "Staff",        icon: StaffIcon  },
      { href: "/tables",     label: "Tables & QR",  icon: TableIcon  },
    ],
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="flex w-60 flex-shrink-0 flex-col bg-[#0f172a]">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 flex-shrink-0">
            <span className="text-xs font-black text-white">B</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-none">Blessed Ave</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Management</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {section.label}
              </p>
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link key={href} href={href}
                    className={clsx(
                      "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition mb-0.5",
                      active
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )}
                  >
                    <Icon active={active} />
                    <span className="font-medium">{label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/5 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300 flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-600 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-slate-600 hover:text-slate-400 transition text-xs">
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
