import { Link, useLocation } from "wouter";
import { Clock, LayoutDashboard, Users, Calendar, Table2, LogOut, ChevronDown, FileBarChart } from "lucide-react";
import { useClerk } from "@clerk/react";
import { useMe } from "@/App";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { me, isAdmin } = useMe();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
    { href: "/clock", label: "Clock In/Out", icon: Clock, adminOnly: false },
    { href: "/employees", label: "Employees", icon: Users, adminOnly: true },
    { href: "/time-entries", label: "Time Log", icon: Table2, adminOnly: false },
    { href: "/time-off", label: "Time Off", icon: Calendar, adminOnly: false },
    { href: "/reports", label: "Reports", icon: FileBarChart, adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin);

  const initials = me?.name
    ? me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-4">
        <div className="flex w-full items-center gap-4 bg-card p-4 rounded-xl border shadow-sm justify-between">
          <div className="flex items-center gap-6">
            <div className="font-semibold text-lg flex items-center gap-2 text-primary shrink-0">
              <img src={`${basePath}/logo.svg`} alt="TimeClock" className="h-6 w-6" />
              TimeClock
            </div>
            <nav className="hidden md:flex gap-6 text-sm font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 transition-colors hover:text-foreground ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="button-user-menu"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </div>
                <span className="hidden sm:block text-foreground">{me?.name ?? "Loading..."}</span>
                {isAdmin && (
                  <span className="hidden sm:block text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {me?.department ?? me?.email ?? ""}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="button-sign-out"
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:p-8">
        {children}
      </main>
    </div>
  );
}
