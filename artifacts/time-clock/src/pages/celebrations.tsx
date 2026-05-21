import { useMemo, useState } from "react";
import { useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Star, ChevronLeft, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { useLocation } from "wouter";

type EventKind = "birthday" | "anniversary";

interface CelebrationEvent {
  employeeId: number;
  employeeName: string;
  department: string | null;
  imageUrl: string | null;
  kind: EventKind;
  monthDay: string;
  daysUntil: number;
  nextDate: string;
  yearsOfService: number | null;
  age: number | null;
}

function getNextOccurrence(month: number, day: number, today: Date): { date: Date; daysUntil: number } {
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  const target = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, month - 1, day);
  const daysUntil = Math.round((target.getTime() - today.getTime()) / 86400000);
  return { date: target, daysUntil };
}

function buildEvents(
  employees: { id: number; name: string; department?: string | null; imageUrl?: string | null; birthday?: string | null; hiredDate?: string | null }[],
  today: Date,
): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];

  for (const emp of employees) {
    if (emp.birthday) {
      const parts = emp.birthday.split("-").map(Number);
      const birthYear = parts[0];
      const month = parts[1];
      const day = parts[2];
      const { date, daysUntil } = getNextOccurrence(month, day, today);
      const age = date.getFullYear() - birthYear;
      events.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department ?? null,
        imageUrl: emp.imageUrl ?? null,
        kind: "birthday",
        monthDay: new Date(today.getFullYear(), month - 1, day).toLocaleDateString([], { month: "long", day: "numeric" }),
        daysUntil,
        nextDate: date.toISOString().split("T")[0],
        yearsOfService: null,
        age,
      });
    }

    if (emp.hiredDate) {
      const parts = emp.hiredDate.split("-").map(Number);
      const hireYear = parts[0];
      const month = parts[1];
      const day = parts[2];
      const { date, daysUntil } = getNextOccurrence(month, day, today);
      const years = date.getFullYear() - hireYear;
      if (years <= 0) continue;
      events.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department ?? null,
        imageUrl: emp.imageUrl ?? null,
        kind: "anniversary",
        monthDay: new Date(today.getFullYear(), month - 1, day).toLocaleDateString([], { month: "long", day: "numeric" }),
        daysUntil,
        nextDate: date.toISOString().split("T")[0],
        yearsOfService: years,
        age: null,
      });
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

function daysLabel(n: number): string {
  if (n === 0) return "Today!";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

function EventRow({ event }: { event: CelebrationEvent }) {
  const isBirthday = event.kind === "birthday";
  const isUpcoming = event.daysUntil <= 30;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
      <EmployeeAvatar name={event.employeeName} imageUrl={event.imageUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{event.employeeName}</p>
          {event.department && (
            <span className="text-xs text-muted-foreground">{event.department}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {isBirthday ? (
            <Gift className="h-3 w-3 text-pink-500 shrink-0" />
          ) : (
            <Star className="h-3 w-3 text-amber-500 shrink-0" />
          )}
          <span className="text-xs text-muted-foreground">
            {event.monthDay}
            {isBirthday && event.age != null && ` · Turns ${event.age}`}
            {!isBirthday && event.yearsOfService != null && (
              ` · ${event.yearsOfService === 1 ? "1 year" : `${event.yearsOfService} years`}`
            )}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {isUpcoming ? (
          <Badge
            className={
              event.daysUntil === 0
                ? "bg-green-100 text-green-800 border-green-200"
                : isBirthday
                  ? "bg-pink-100 text-pink-800 border-pink-200"
                  : "bg-amber-100 text-amber-800 border-amber-200"
            }
          >
            {daysLabel(event.daysUntil)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{daysLabel(event.daysUntil)}</span>
        )}
      </div>
    </div>
  );
}

type Tab = "all" | "birthdays" | "anniversaries";

export default function Celebrations() {
  const [, setLocation] = useLocation();
  const { data: employees, isLoading } = useListEmployees();
  const [tab, setTab] = useState<Tab>("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const allEvents = useMemo(
    () => (employees ? buildEvents(employees, today) : []),
    [employees, today],
  );

  const upcoming = allEvents.filter((e) => e.daysUntil <= 30);
  const birthdays = allEvents.filter((e) => e.kind === "birthday");
  const anniversaries = allEvents.filter((e) => e.kind === "anniversary");

  const tabEvents: CelebrationEvent[] =
    tab === "birthdays" ? birthdays : tab === "anniversaries" ? anniversaries : allEvents;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: allEvents.length },
    { key: "birthdays", label: "Birthdays", count: birthdays.length },
    { key: "anniversaries", label: "Anniversaries", count: anniversaries.length },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back button + header */}
      <div>
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-pink-500" />
          Birthdays &amp; Anniversaries
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upcoming and future celebrations for your team
        </p>
      </div>

      {/* Coming up soon */}
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : upcoming.length > 0 ? (
        <Card className="border-pink-200 bg-gradient-to-br from-pink-50/60 to-amber-50/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-pink-500 animate-pulse" />
              <CardTitle className="text-base">Coming Up — Next 30 Days</CardTitle>
            </div>
            <CardDescription>{upcoming.length} celebration{upcoming.length !== 1 ? "s" : ""} ahead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((e, i) => (
              <EventRow key={`${e.employeeId}-${e.kind}-${i}`} event={e} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No birthdays or anniversaries in the next 30 days.
          </CardContent>
        </Card>
      )}

      {/* Full list with tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Full Team List</CardTitle>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-2 p-1 rounded-lg bg-muted w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-muted-foreground">({t.count})</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : tabEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No {tab === "birthdays" ? "birthdays" : tab === "anniversaries" ? "anniversaries" : "celebrations"} on record.
            </div>
          ) : (
            <div className="space-y-2">
              {tabEvents.map((e, i) => (
                <EventRow key={`${e.employeeId}-${e.kind}-${i}`} event={e} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
