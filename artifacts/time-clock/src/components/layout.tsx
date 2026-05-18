import { Link, useLocation } from "wouter";
import { Clock, LayoutDashboard, Users, Calendar, Table2 } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clock", label: "Clock In/Out", icon: Clock },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/time-entries", label: "Time Log", icon: Table2 },
    { href: "/time-off", label: "Time Off", icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-4">
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-between bg-card p-4 rounded-xl border shadow-sm">
          <div className="font-semibold text-lg flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
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
      </header>
      <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:p-8">
        {children}
      </main>
    </div>
  );
}
