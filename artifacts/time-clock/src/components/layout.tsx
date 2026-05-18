import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Clock, LayoutDashboard, Users, Calendar, Table2, LogOut, ChevronDown, FileBarChart, UserCircle, Gift, Palette, Check } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { useMe } from "@/App";
import { useTheme, THEMES } from "@/contexts/theme-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { me, isAdmin } = useMe();
  const { theme, setTheme } = useTheme();
  const [imgError, setImgError] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
    { href: "/clock", label: "Clock In/Out", icon: Clock, adminOnly: false },
    { href: "/employees", label: "Employees", icon: Users, adminOnly: true },
    { href: "/time-entries", label: "Time Log", icon: Table2, adminOnly: false },
    { href: "/time-off", label: "Time Off", icon: Calendar, adminOnly: false },
    { href: "/holidays", label: "Holidays", icon: Gift, adminOnly: true },
    { href: "/reports", label: "Reports", icon: FileBarChart, adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin);

  const initials = me?.name
    ? me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const currentTheme = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  const photoUrl = isLoaded && user?.imageUrl && !imgError ? user.imageUrl : null;

  const Avatar = ({ size }: { size: "sm" | "lg" }) => {
    const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";
    if (photoUrl) {
      return (
        <img
          key={photoUrl}
          src={photoUrl}
          alt={me?.name ?? "Profile"}
          className={`${dim} rounded-full object-cover ring-2 ring-white/30 shrink-0`}
          onError={() => setImgError(true)}
        />
      );
    }
    return (
      <div className={`${dim} flex items-center justify-center rounded-full bg-white/20 text-white font-semibold ring-2 ring-white/30 shrink-0`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-4">
        <div
          className="flex w-full items-center p-3 px-4 rounded-xl shadow-md justify-between"
          style={{ background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--nav-gradient-to)))` }}
        >
          <div className="flex items-center gap-6">
            <div className="font-bold text-lg flex items-center gap-2 text-white shrink-0">
              <img src={`${basePath}/logo.svg`} alt="TimeClock" className="h-6 w-6 brightness-0 invert" />
              TimeClock
            </div>
            <nav className="hidden md:flex gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/10"
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
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-white/10 transition-colors text-white"
              >
                <Avatar size="sm" />
                <span className="hidden sm:block">{me?.name ?? "Loading..."}</span>
                {isAdmin && (
                  <span className="hidden sm:block text-xs bg-white/20 text-white px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Profile header */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/60 rounded-sm transition-colors"
                onClick={() => setLocation("/profile")}
              >
                <Avatar size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{me?.name ?? "..."}</p>
                  <p className="text-xs text-muted-foreground truncate">{me?.email ?? me?.department ?? ""}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLocation("/profile")}
                className="cursor-pointer gap-2"
              >
                <UserCircle className="h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                  <Palette className="h-4 w-4" />
                  <span>Theme</span>
                  <span className={`ml-auto h-3 w-3 rounded-full ${currentTheme.dot}`} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {THEMES.map((t) => (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className="flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className={`h-3.5 w-3.5 rounded-full border-2 ${t.dot} border-opacity-60`} />
                      <span>{t.label}</span>
                      {theme === t.value && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
