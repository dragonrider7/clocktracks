import {
  useGetDashboardStatus,
  useGetWeeklyHours,
  useGetPendingRequests,
  useGetOutThisWeek,
  useGetUpcomingEvents,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CalendarIcon, Umbrella, TrendingUp, Gift, Star, ArrowRight, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { useLocation } from "wouter";

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-700",
  sick: "bg-red-100 text-red-700",
  personal: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

function fmtDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { month: "short", day: "numeric" });
}

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  isLoading?: boolean;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, accentClass, isLoading, onClick }: StatCardProps) {
  return (
    <Card
      className={`overflow-hidden transition-shadow ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}
      onClick={onClick}
    >
      <div className={`h-1 w-full ${accentClass}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accentClass} text-white`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold">{value}</div>
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50 mb-1" />}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ViewAllLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
    >
      View all <ArrowRight className="h-3 w-3" />
    </button>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: status, isLoading: statusLoading } = useGetDashboardStatus();
  const { data: weeklyHours, isLoading: hoursLoading } = useGetWeeklyHours();
  const { data: pendingRequests, isLoading: pendingLoading } = useGetPendingRequests();
  const { data: outThisWeek, isLoading: outLoading } = useGetOutThisWeek();
  const { data: upcomingEvents, isLoading: eventsLoading } = useGetUpcomingEvents();

  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clocked In"
          value={`${status?.clockedInCount ?? 0} / ${status?.totalEmployees ?? 0}`}
          subtitle="Currently working"
          icon={<Users className="h-4 w-4" />}
          accentClass="bg-blue-500"
          isLoading={statusLoading}
          onClick={() => setLocation("/time-entries")}
        />
        <StatCard
          title="Today's Hours"
          value={`${status?.todayTotalHours?.toFixed(1) ?? "0.0"} hrs`}
          subtitle="Total hours tracked today"
          icon={<Clock className="h-4 w-4" />}
          accentClass="bg-emerald-500"
          isLoading={statusLoading}
          onClick={() => setLocation("/time-entries")}
        />
        <StatCard
          title="Pending Time Off"
          value={pendingRequests?.count ?? 0}
          subtitle="Requests awaiting approval"
          icon={<CalendarIcon className="h-4 w-4" />}
          accentClass="bg-amber-500"
          isLoading={pendingLoading}
          onClick={() => setLocation("/time-off")}
        />
        <StatCard
          title="Out This Week"
          value={outThisWeek?.length ?? 0}
          subtitle="On approved time off"
          icon={<Umbrella className="h-4 w-4" />}
          accentClass="bg-violet-500"
          isLoading={outLoading}
          onClick={() => setLocation("/time-off")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <CardTitle>Currently Clocked In</CardTitle>
              <ViewAllLink onClick={() => setLocation("/time-entries")} />
            </div>
            <CardDescription>Real-time view of active team members</CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (status?.clockedInEmployees?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No one is currently clocked in.
              </div>
            ) : (
              <div className="space-y-2">
                {status?.clockedInEmployees?.map((emp) => (
                  <button
                    key={emp.employeeId}
                    onClick={() => setLocation("/time-entries")}
                    className="w-full flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={emp.employeeName} imageUrl={emp.imageUrl} size="md" />
                      <div>
                        <p className="text-sm font-semibold leading-none">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{emp.department ?? "No Department"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Since {new Date(emp.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <CardTitle>This Week's Hours</CardTitle>
              <ViewAllLink onClick={() => setLocation("/time-entries")} />
            </div>
            <CardDescription>Total hours worked this week</CardDescription>
          </CardHeader>
          <CardContent>
            {hoursLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (weeklyHours?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No hours tracked this week.</div>
            ) : (
              <div className="space-y-3">
                {weeklyHours?.map((emp) => {
                  const hrs = emp.totalMinutes / 60;
                  const pct = Math.min(100, (hrs / 40) * 100);
                  return (
                    <button
                      key={emp.employeeId}
                      onClick={() => setLocation("/time-entries")}
                      className="w-full space-y-1 group text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar name={emp.employeeName} imageUrl={emp.imageUrl} size="xs" />
                          <span className="font-medium">{emp.employeeName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-emerald-700">{hrs.toFixed(1)} hrs</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Umbrella className="h-4 w-4 text-violet-500" />
              <CardTitle>Out This Week</CardTitle>
              <ViewAllLink onClick={() => setLocation("/time-off")} />
            </div>
            <CardDescription>Employees on approved time off this week</CardDescription>
          </CardHeader>
          <CardContent>
            {outLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (outThisWeek?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No one is on approved time off this week.
              </div>
            ) : (
              <div className="grid gap-2">
                {outThisWeek?.map((item) => (
                  <button
                    key={item.requestId}
                    onClick={() => setLocation("/time-off")}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-violet-50 border-violet-100 hover:bg-violet-100/70 transition-colors group text-left"
                  >
                    <EmployeeAvatar name={item.employeeName} imageUrl={item.imageUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{item.employeeName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge className={`text-xs px-1.5 py-0 ${TYPE_COLORS[item.type] ?? TYPE_COLORS.other}`}>
                          {item.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDateShort(item.startDate)}
                          {item.startDate !== item.endDate && ` – ${fmtDateShort(item.endDate)}`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-500" />
              <CardTitle>Upcoming Celebrations</CardTitle>
            </div>
            <CardDescription>Birthdays and work anniversaries in the next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (upcomingEvents?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No upcoming birthdays or anniversaries.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents?.map((event, idx) => (
                  <div
                    key={`${event.employeeId}-${event.kind}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      event.kind === "birthday"
                        ? "bg-pink-50 border-pink-100"
                        : "bg-amber-50 border-amber-100"
                    }`}
                  >
                    <EmployeeAvatar name={event.employeeName} imageUrl={event.imageUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{event.employeeName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {event.kind === "birthday" ? (
                          <Gift className="h-3 w-3 text-pink-500 shrink-0" />
                        ) : (
                          <Star className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground">{event.label}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {fmtDateShort(event.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.daysUntil === 0 ? "Today!" : event.daysUntil === 1 ? "Tomorrow" : `In ${event.daysUntil} days`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
