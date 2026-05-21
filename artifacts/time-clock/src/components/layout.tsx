import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Clock, LayoutDashboard, Users, Calendar, Table2, LogOut, ChevronDown, FileBarChart, UserCircle, Gift, Palette, Check, Bell, Settings, EyeOff, Eye, Menu, KeyRound } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { useMe } from "@/contexts/me-context";
import { useLicense } from "@/contexts/license-context";
import { LicenseBanner } from "@/components/license-banner";
import { LicenseDialog } from "@/components/license-dialog";
import { useTheme, THEMES } from "@/contexts/theme-context";
import {
  useGetUnreadNotificationCount,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell({ employeeId }: { employeeId: number | undefined }) {
  const queryClient = useQueryClient();
  const countParams = employeeId ? { employeeId } : { employeeId: 0 };

  const { data: countData } = useGetUnreadNotificationCount(countParams, {
    query: {
      enabled: !!employeeId,
      queryKey: getGetUnreadNotificationCountQueryKey(countParams),
      refetchInterval: 30000,
    },
  });

  const { data: notifications } = useListNotifications(countParams, {
    query: {
      enabled: !!employeeId,
      queryKey: getListNotificationsQueryKey(countParams),
      refetchInterval: 30000,
    },
  });

  const markAllRead = useMarkAllNotificationsRead();
  const markOneRead = useMarkNotificationRead();

  const unread = countData?.count ?? 0;
  const recent = [...(notifications ?? [])].reverse().slice(0, 10);

  const handleMarkAll = () => {
    if (!employeeId) return;
    markAllRead.mutate(
      { data: { employeeId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey(countParams) });
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey(countParams) });
        },
      }
    );
  };

  const handleMarkOne = (n: Notification) => {
    if (n.read) return;
    markOneRead.mutate(
      { id: n.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey(countParams) });
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey(countParams) });
        },
      }
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors text-white">
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[440px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          recent.map((n) => (
            <button
              key={n.id}
              onClick={() => handleMarkOne(n)}
              className={`w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.read ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                )}
                {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isGhostMode(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith("_ctsa="));
}

async function ghostSignOut() {
  await fetch(`${basePath}/api/superadmin/logout`, { method: "POST" }).catch(() => {});
  window.location.href = basePath + "/ghost";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { me, isAdmin, isViewingAsEmployee, setIsViewingAsEmployee } = useMe();
  const isActualAdmin = me?.role === "admin";
  const { theme, setTheme } = useTheme();
  const { tier } = useLicense();
  const [imgError, setImgError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  const licenseHiddenRoutes =
    tier === "minimal" || tier === "locked"
      ? ["/employees", "/time-entries", "/time-off", "/holidays", "/reports", "/admin"]
      : tier === "limited"
        ? ["/employees", "/holidays", "/reports", "/admin"]
        : [];

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false, alwaysForAdmin: false },
    { href: "/clock", label: "Clock In/Out", icon: Clock, adminOnly: false, alwaysForAdmin: false },
    { href: "/employees", label: "Employees", icon: Users, adminOnly: true, alwaysForAdmin: false },
    { href: "/time-entries", label: "Time Log", icon: Table2, adminOnly: false, alwaysForAdmin: false },
    { href: "/time-off", label: "Time Off", icon: Calendar, adminOnly: false, alwaysForAdmin: false },
    { href: "/holidays", label: "Holidays", icon: Gift, adminOnly: true, alwaysForAdmin: false },
    { href: "/reports", label: "Reports", icon: FileBarChart, adminOnly: true, alwaysForAdmin: false },
    { href: "/admin", label: "Admin", icon: Settings, adminOnly: true, alwaysForAdmin: true },
  ]
    .filter((item) => item.alwaysForAdmin ? isActualAdmin : (!item.adminOnly || isAdmin))
    .filter((item) => !licenseHiddenRoutes.includes(item.href));

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
      <LicenseBanner />
      {isViewingAsEmployee && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4" />
            <span className="font-medium">Employee View Mode</span>
            <span className="text-amber-700">— Admin features are hidden. You are seeing the app as an employee.</span>
          </div>
          <button
            onClick={() => setIsViewingAsEmployee(false)}
            className="text-amber-900 font-semibold hover:underline flex items-center gap-1 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            Return to Admin View
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-4">
        <div
          className="flex w-full items-center p-3 px-4 rounded-xl shadow-md justify-between"
          style={{ background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--nav-gradient-to)))` }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors text-white">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <div
                  className="flex items-center gap-2 px-5 py-4"
                  style={{ background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--nav-gradient-to)))` }}
                >
                  <img src={`${basePath}/clocktracks-logo-dark.png`} alt="ClockTracks" className="h-10 w-auto" />
                </div>
                <nav className="flex flex-col gap-1 p-3 flex-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                {isViewingAsEmployee && (
                  <div className="p-3 border-t">
                    <button
                      onClick={() => { setIsViewingAsEmployee(false); setMobileOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-900"
                    >
                      <Eye className="h-4 w-4" />
                      Exit Employee Preview
                    </button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <div className="flex items-center shrink-0">
              <img src={`${basePath}/clocktracks-logo-dark.png`} alt="ClockTracks" className="h-10 w-auto md:block hidden" />
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

          <div className="flex items-center gap-2">
            {isActualAdmin && (
              <button
                onClick={() => setIsViewingAsEmployee(!isViewingAsEmployee)}
                title={isViewingAsEmployee ? "Return to Admin View" : "Preview Employee View"}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isViewingAsEmployee
                    ? "bg-amber-400/90 text-amber-900 hover:bg-amber-400"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {isViewingAsEmployee ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span className="hidden sm:block">{isViewingAsEmployee ? "Exit Preview" : "Employee View"}</span>
              </button>
            )}

            <NotificationBell employeeId={me?.id} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="button-user-menu"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-white/10 transition-colors text-white"
                >
                  <Avatar size="sm" />
                  {me?.name && (
                    <span className="hidden sm:block">{me.name}</span>
                  )}
                  {isAdmin && (
                    <span className="hidden sm:block text-xs bg-white/20 text-white px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-white/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                {isActualAdmin && (
                  <DropdownMenuItem
                    onClick={() => setLicenseDialogOpen(true)}
                    className="cursor-pointer gap-2"
                  >
                    <KeyRound className="h-4 w-4" />
                    License
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="button-sign-out"
                  onClick={() => isGhostMode() ? ghostSignOut() : signOut({ redirectUrl: basePath || "/" })}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:p-8">
        {children}
      </main>

      <LicenseDialog open={licenseDialogOpen} onOpenChange={setLicenseDialogOpen} />
    </div>
  );
}
