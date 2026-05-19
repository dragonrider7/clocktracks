import { useState } from "react";
import {
  useGetTimesheetReport,
  useGetTimeOffBalances,
  useListEmployees,
} from "@workspace/api-client-react";
import type { TimesheetEntry, TimeOffBalance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronDown, ChevronUp, Clock4, Umbrella, CalendarDays, FileText } from "lucide-react";
import { useMe } from "@/contexts/me-context";
import { Redirect } from "wouter";
import { EmployeeAvatar } from "@/components/employee-avatar";

type Preset = "this-week" | "last-week" | "this-biweek" | "last-biweek" | "custom";
type ReportTab = "timesheets" | "time-off";

const TIME_OFF_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation", pto: "PTO", sick: "Sick Day",
  bereavement: "Bereavement", personal: "Personal", other: "Other",
  holiday: "Holiday",
};
const TIME_OFF_TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-800", pto: "bg-sky-100 text-sky-800",
  sick: "bg-red-100 text-red-800", bereavement: "bg-gray-100 text-gray-700",
  personal: "bg-purple-100 text-purple-800", other: "bg-zinc-100 text-zinc-700",
  holiday: "bg-amber-100 text-amber-800",
};

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0); return d;
}
function toDateStr(d: Date): string { return d.toISOString().split("T")[0]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getPresetRange(preset: Preset): { startDate: string; endDate: string } {
  const today = new Date(); const thisSunday = getSundayOfWeek(today);
  switch (preset) {
    case "this-week": return { startDate: toDateStr(thisSunday), endDate: toDateStr(addDays(thisSunday, 6)) };
    case "last-week": { const ls = addDays(thisSunday, -7); return { startDate: toDateStr(ls), endDate: toDateStr(addDays(ls, 6)) }; }
    case "this-biweek": return { startDate: toDateStr(addDays(thisSunday, -7)), endDate: toDateStr(addDays(thisSunday, 6)) };
    case "last-biweek": return { startDate: toDateStr(addDays(thisSunday, -21)), endDate: toDateStr(addDays(thisSunday, -8)) };
    case "custom": return { startDate: toDateStr(thisSunday), endDate: toDateStr(addDays(thisSunday, 6)) };
  }
}

function fmtHours(h: number): string { return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`; }
function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── Timesheet Entry Row ────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: TimesheetEntry }) {
  if (entry.kind === "time_off") {
    const colorClass = TIME_OFF_TYPE_COLORS[entry.timeOffType ?? "other"] ?? TIME_OFF_TYPE_COLORS.other;
    const label = TIME_OFF_TYPE_LABELS[entry.timeOffType ?? "other"] ?? entry.timeOffType ?? "Time Off";
    return (
      <tr className="border-t bg-amber-50/50 dark:bg-amber-950/10">
        <td className="px-5 py-2 text-muted-foreground">{fmtDate(entry.date)}</td>
        <td className="px-5 py-2" colSpan={2}>
          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            {label}
          </span>
        </td>
        <td className="px-5 py-2 text-right font-mono text-sm">8h</td>
        <td className="px-5 py-2 text-muted-foreground text-xs">{entry.notes || "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-t hover:bg-muted/20">
      <td className="px-5 py-2 text-muted-foreground">{entry.clockIn ? fmtDate(entry.date) : "—"}</td>
      <td className="px-5 py-2 font-mono text-sm">{entry.clockIn ? fmtTime(entry.clockIn) : "—"}</td>
      <td className="px-5 py-2 font-mono text-sm">
        {entry.clockOut ? fmtTime(entry.clockOut) : <Badge variant="outline" className="text-xs">Still in</Badge>}
      </td>
      <td className="px-5 py-2 text-right font-mono text-sm">
        {entry.totalMinutes != null ? fmtMinutes(entry.totalMinutes) : "—"}
      </td>
      <td className="px-5 py-2 text-muted-foreground text-xs">{entry.notes || "—"}</td>
    </tr>
  );
}

// ─── Type colors/labels for breakdown ────────────────────────────────────────
const TYPE_BG: Record<string, string> = {
  vacation: "bg-blue-500", pto: "bg-sky-400", sick: "bg-red-400",
  bereavement: "bg-gray-400", personal: "bg-purple-400", other: "bg-zinc-400",
};
const TYPE_PENDING_BG: Record<string, string> = {
  vacation: "bg-blue-200", pto: "bg-sky-200", sick: "bg-red-200",
  bereavement: "bg-gray-200", personal: "bg-purple-200", other: "bg-zinc-200",
};

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.getTime() === e.getTime()) return s.toLocaleDateString([], opts);
  if (s.getFullYear() === e.getFullYear()) return `${s.toLocaleDateString([], opts)} – ${e.toLocaleDateString([], opts)}`;
  return `${s.toLocaleDateString([], { ...opts, year: "numeric" })} – ${e.toLocaleDateString([], { ...opts, year: "numeric" })}`;
}

function EmployeeBalanceCard({ b }: { b: TimeOffBalance }) {
  const [expanded, setExpanded] = useState(false);
  const pctUsed = b.allottedHours > 0 ? Math.min(100, (b.usedHours / b.allottedHours) * 100) : 0;
  const pctPlanned = b.allottedHours > 0 ? Math.min(100 - pctUsed, (b.plannedHours / b.allottedHours) * 100) : 0;
  const overBudget = b.usedPlusPlannedHours > b.allottedHours;
  const hasRequests = b.requests.length > 0;
  const approved = b.requests.filter((r) => r.status === "approved");
  const pending = b.requests.filter((r) => r.status === "pending");

  return (
    <Card className="overflow-hidden">
      {/* Top progress bar */}
      <div className="h-1.5 w-full bg-muted overflow-hidden">
        <div className="h-full flex">
          <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctUsed}%` }} />
          <div className="bg-amber-400 h-full transition-all" style={{ width: `${pctPlanned}%` }} />
        </div>
      </div>

      {/* Summary row */}
      <div
        className={`px-5 py-4 ${hasRequests ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
        onClick={() => hasRequests && setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <EmployeeAvatar name={b.employeeName} imageUrl={b.imageUrl} size="md" />
            <div>
              <p className="font-semibold">{b.employeeName}</p>
              {b.department && <p className="text-xs text-muted-foreground">{b.department}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="text-center min-w-[3rem]">
                <div className="text-lg font-bold">{fmtHours(b.allottedHours)}</div>
                <div className="text-xs text-muted-foreground">Allotted</div>
              </div>
              <div className="text-center min-w-[3rem]">
                <div className="text-lg font-bold text-blue-600">{fmtHours(b.usedHours)}</div>
                <div className="text-xs text-muted-foreground">Used</div>
              </div>
              <div className="text-center min-w-[3rem]">
                <div className="text-lg font-bold text-amber-500">{fmtHours(b.plannedHours)}</div>
                <div className="text-xs text-muted-foreground">Planned</div>
              </div>
              <div className="text-center min-w-[3rem] border-l pl-4">
                <div className={`text-lg font-bold ${overBudget ? "text-destructive" : "text-emerald-600"}`}>
                  {overBudget ? "0h" : fmtHours(b.remainingHours)}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
                {overBudget && (
                  <Badge variant="destructive" className="text-[10px] mt-0.5">
                    Over {fmtHours(b.usedPlusPlannedHours - b.allottedHours)}
                  </Badge>
                )}
              </div>
            </div>
            {hasRequests && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {b.requests.length} {b.requests.length === 1 ? "request" : "requests"}
                {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
              </div>
            )}
          </div>
        </div>

        {/* Per-type breakdown pills — always visible */}
        {b.breakdown.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {b.breakdown.map((bd) => {
              const label = TIME_OFF_TYPE_LABELS[bd.type] ?? bd.type;
              const color = TIME_OFF_TYPE_COLORS[bd.type] ?? TIME_OFF_TYPE_COLORS.other;
              return (
                <span key={bd.type} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
                  {label}
                  {bd.usedHours > 0 && <span className="font-bold">{fmtHours(bd.usedHours)} used</span>}
                  {bd.plannedHours > 0 && (
                    <span className="opacity-75">{bd.usedHours > 0 ? " · " : ""}{fmtHours(bd.plannedHours)} planned</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasRequests && (
        <div className="border-t bg-muted/20">
          {/* Approved requests */}
          {approved.length > 0 && (
            <div>
              <div className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30">
                Approved ({approved.length})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">Date(s)</th>
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-center px-5 py-2 font-medium text-muted-foreground">Days</th>
                    <th className="text-center px-5 py-2 font-medium text-muted-foreground">Hours</th>
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-2 text-muted-foreground">{fmtDateRange(r.startDate, r.endDate)}</td>
                      <td className="px-5 py-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TIME_OFF_TYPE_COLORS[r.type] ?? TIME_OFF_TYPE_COLORS.other}`}>
                          {TIME_OFF_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-center tabular-nums">{r.days}d</td>
                      <td className="px-5 py-2 text-center tabular-nums font-medium">{fmtHours(r.hours)}</td>
                      <td className="px-5 py-2 text-muted-foreground text-xs">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending requests */}
          {pending.length > 0 && (
            <div className={approved.length > 0 ? "border-t" : ""}>
              <div className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30">
                Pending Approval ({pending.length})
              </div>
              <table className="w-full text-sm">
                {approved.length === 0 && (
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-5 py-2 font-medium text-muted-foreground">Date(s)</th>
                      <th className="text-left px-5 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-center px-5 py-2 font-medium text-muted-foreground">Days</th>
                      <th className="text-center px-5 py-2 font-medium text-muted-foreground">Hours</th>
                      <th className="text-left px-5 py-2 font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-amber-50/50 bg-amber-50/30">
                      <td className="px-5 py-2 text-muted-foreground">{fmtDateRange(r.startDate, r.endDate)}</td>
                      <td className="px-5 py-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TIME_OFF_TYPE_COLORS[r.type] ?? TIME_OFF_TYPE_COLORS.other}`}>
                          {TIME_OFF_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-center tabular-nums">{r.days}d</td>
                      <td className="px-5 py-2 text-center tabular-nums font-medium">{fmtHours(r.hours)}</td>
                      <td className="px-5 py-2 text-muted-foreground text-xs">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Time Off Balances Tab ───────────────────────────────────────────────────
function TimeOffBalancesTab({ employees }: { employees: { id: number; name: string }[] | undefined }) {
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const employeeId = filterEmployee !== "all" ? parseInt(filterEmployee) : undefined;
  const yearParam = parseInt(year);
  const { data: balances, isLoading } = useGetTimeOffBalances(
    { ...(employeeId ? { employeeId } : {}), year: yearParam },
  );

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(String);

  const totalUsed = balances?.reduce((s, b) => s + b.usedHours, 0) ?? 0;
  const totalPlanned = balances?.reduce((s, b) => s + b.plannedHours, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee</label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
        </div>
      ) : !balances || balances.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No time off data for {year}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {balances.map((b) => <EmployeeBalanceCard key={b.employeeId} b={b} />)}

          {/* Footer totals */}
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-5 flex items-center justify-between flex-wrap gap-3">
              <span className="font-semibold">Total — {year}</span>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="text-muted-foreground">{balances.length} employees</span>
                <span className="flex items-center gap-1.5 font-medium text-blue-600">
                  <span className="inline-block h-2 w-2 rounded bg-blue-500" />
                  {fmtHours(totalUsed)} used
                </span>
                {totalPlanned > 0 && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-600">
                    <span className="inline-block h-2 w-2 rounded bg-amber-400" />
                    {fmtHours(totalPlanned)} planned
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded bg-blue-500" /> Used (approved)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-400" /> Planned (pending)</span>
            <span className="text-muted-foreground/60">Click a card to expand individual requests</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timesheets Tab ──────────────────────────────────────────────────────────
function TimesheetsTab({ employees }: { employees: { id: number; name: string }[] | undefined }) {
  const [preset, setPreset] = useState<Preset>("this-week");
  const [customStart, setCustomStart] = useState(toDateStr(getSundayOfWeek(new Date())));
  const [customEnd, setCustomEnd] = useState(toDateStr(addDays(getSundayOfWeek(new Date()), 6)));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { startDate, endDate } = preset === "custom"
    ? { startDate: customStart, endDate: customEnd }
    : getPresetRange(preset);
  const employeeId = selectedEmployee !== "all" ? parseInt(selectedEmployee) : undefined;
  const { data: report, isLoading } = useGetTimesheetReport({ startDate, endDate, employeeId });

  const totalWorkMinutes = report?.reduce((s, e) => s + e.totalMinutes, 0) ?? 0;
  const totalTimeOffMinutes = report?.reduce((s, e) => s + (e.totalTimeOffMinutes ?? 0), 0) ?? 0;
  const toggleExpand = (id: number) => setExpandedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setExpandedIds(new Set(report?.map((e) => e.employeeId) ?? []));
  const collapseAll = () => setExpandedIds(new Set());

  const generateReport = () => {
    if (!report || report.length === 0) return;
    const rangeLabel = `${startDate} to ${endDate}`;
    const generatedAt = new Date().toLocaleString([], { dateStyle: "long", timeStyle: "short" });

    const entryRows = (entries: typeof report[0]["entries"]) => entries.map((e) => {
      if (e.kind === "time_off") {
        const label = TIME_OFF_TYPE_LABELS[e.timeOffType ?? "other"] ?? e.timeOffType ?? "Time Off";
        const colorMap: Record<string, string> = {
          vacation: "#dbeafe", pto: "#e0f2fe", sick: "#fee2e2",
          bereavement: "#f3f4f6", personal: "#f3e8ff", other: "#f4f4f5", holiday: "#fef3c7",
        };
        const textMap: Record<string, string> = {
          vacation: "#1e40af", pto: "#0369a1", sick: "#991b1b",
          bereavement: "#374151", personal: "#6b21a8", other: "#3f3f46", holiday: "#92400e",
        };
        const bg = colorMap[e.timeOffType ?? "other"] ?? "#f4f4f5";
        const color = textMap[e.timeOffType ?? "other"] ?? "#3f3f46";
        return `<tr style="background:#fffbeb">
          <td style="padding:6px 12px;color:#6b7280">${e.date ?? "—"}</td>
          <td colspan="2" style="padding:6px 12px">
            <span style="background:${bg};color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500">${label}</span>
          </td>
          <td style="padding:6px 12px;text-align:right;font-family:monospace;font-weight:600">8h</td>
          <td style="padding:6px 12px;color:#6b7280;font-size:12px">${e.notes ?? "—"}</td>
        </tr>`;
      }
      const clockIn = e.clockIn ? new Date(e.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
      const clockOut = e.clockOut ? new Date(e.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Still in";
      const dur = e.totalMinutes != null ? fmtMinutes(e.totalMinutes) : "—";
      return `<tr>
        <td style="padding:6px 12px;color:#6b7280">${e.date ?? "—"}</td>
        <td style="padding:6px 12px;font-family:monospace">${clockIn}</td>
        <td style="padding:6px 12px;font-family:monospace">${clockOut}</td>
        <td style="padding:6px 12px;text-align:right;font-family:monospace;font-weight:600">${dur}</td>
        <td style="padding:6px 12px;color:#6b7280;font-size:12px">${e.notes ?? "—"}</td>
      </tr>`;
    }).join("");

    const pages = report.map((emp, idx) => {
      const isLast = idx === report.length - 1;
      const workHrs = fmtMinutes(emp.totalMinutes);
      const offHrs = emp.totalTimeOffMinutes ? fmtMinutes(emp.totalTimeOffMinutes) : null;
      return `
        <div class="page" style="${isLast ? "" : "page-break-after:always;"}padding:40px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px">TimeClock · Employee Timesheet Report</div>
              <div style="font-size:22px;font-weight:700">${emp.employeeName}</div>
              ${emp.department ? `<div style="font-size:13px;color:#6b7280;margin-top:2px">${emp.department}</div>` : ""}
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;color:#6b7280">Period</div>
              <div style="font-weight:600;font-size:14px">${rangeLabel}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:4px">Generated ${generatedAt}</div>
            </div>
          </div>

          <!-- Summary pills -->
          <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 18px;min-width:110px">
              <div style="font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Work</div>
              <div style="font-size:20px;font-weight:700;color:#15803d;font-family:monospace">${workHrs}</div>
            </div>
            ${offHrs ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 18px;min-width:110px">
              <div style="font-size:11px;color:#d97706;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Time Off</div>
              <div style="font-size:20px;font-weight:700;color:#b45309;font-family:monospace">${offHrs}</div>
            </div>` : ""}
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 18px;min-width:110px">
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Entries</div>
              <div style="font-size:20px;font-weight:700;color:#334155;font-family:monospace">${emp.entries.length}</div>
            </div>
          </div>

          <!-- Entry table -->
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
                <th style="text-align:left;padding:8px 12px;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Date</th>
                <th style="text-align:left;padding:8px 12px;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Clock In</th>
                <th style="text-align:left;padding:8px 12px;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Clock Out</th>
                <th style="text-align:right;padding:8px 12px;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Duration</th>
                <th style="text-align:left;padding:8px 12px;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Notes</th>
              </tr>
            </thead>
            <tbody style="border-bottom:1px solid #e2e8f0">
              ${entryRows(emp.entries)}
            </tbody>
          </table>

          <!-- Footer -->
          <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af">
            <span>${emp.employeeName} · ${rangeLabel}</span>
            <span>Page ${idx + 1} of ${report.length}</span>
          </div>
        </div>`;
    }).join("\n");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Timesheet Report · ${rangeLabel}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#fff}
        tr:nth-child(even){background:#f9fafb}
        tr:hover{background:#f0f9ff}
        @media print{
          @page{margin:0.5in;size:letter portrait}
          .page{page-break-after:always;padding:0}
          .page:last-child{page-break-after:avoid}
          tr:hover{background:inherit}
        }
      </style>
    </head><body>${pages}</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Period</label>
              <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-biweek">This + Last Week (Bi-weekly)</SelectItem>
                  <SelectItem value="last-biweek">Previous Bi-Week</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start</label>
                  <input type="date" className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End</label>
                  <input type="date" className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((emp) => <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : !report || report.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No entries found for this period.</CardContent></Card>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7 gap-1"><ChevronDown className="h-3 w-3" />Expand All</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7 gap-1"><ChevronUp className="h-3 w-3" />Collapse All</Button>
            </div>
            <Button size="sm" onClick={generateReport} className="gap-2 h-8">
              <FileText className="h-3.5 w-3.5" />Generate Per-Employee Report
            </Button>
          </div>

          {report.map((emp) => {
            const isExpanded = expandedIds.has(emp.employeeId);
            const timeOffMins = emp.totalTimeOffMinutes ?? 0;
            return (
              <Card key={emp.employeeId} className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(emp.employeeId)}
                >
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar name={emp.employeeName} imageUrl={emp.imageUrl} size="sm" />
                    <div>
                      <span className="font-semibold">{emp.employeeName}</span>
                      {emp.department && <span className="text-xs text-muted-foreground ml-2">— {emp.department}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="secondary" className="font-mono gap-1">
                      <Clock4 className="h-3 w-3" />{fmtMinutes(emp.totalMinutes)} work
                    </Badge>
                    {timeOffMins > 0 && (
                      <Badge className="font-mono gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Umbrella className="h-3 w-3" />{fmtMinutes(timeOffMins)} off
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{emp.entries.length} entries</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t bg-muted/30">
                            <th className="text-left px-5 py-2 text-muted-foreground font-medium">Date</th>
                            <th className="text-left px-5 py-2 text-muted-foreground font-medium">Clock In</th>
                            <th className="text-left px-5 py-2 text-muted-foreground font-medium">Clock Out</th>
                            <th className="text-right px-5 py-2 text-muted-foreground font-medium">Duration</th>
                            <th className="text-left px-5 py-2 text-muted-foreground font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.entries.map((entry, i) => (
                            <EntryRow key={`${entry.kind}-${entry.id ?? i}-${entry.date}`} entry={entry} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Card className="bg-muted/30">
            <CardContent className="py-3 px-5 flex items-center justify-between flex-wrap gap-3">
              <span className="font-semibold">Total — All Employees</span>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="text-muted-foreground">{report.length} employees</span>
                <Badge className="font-mono gap-1"><Clock4 className="h-3 w-3" />{fmtMinutes(totalWorkMinutes)} work</Badge>
                {totalTimeOffMinutes > 0 && (
                  <Badge className="font-mono gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <Umbrella className="h-3 w-3" />{fmtMinutes(totalTimeOffMinutes)} time off
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Reports() {
  const { isAdmin, isLoading: meLoading } = useMe();
  const { data: employees } = useListEmployees();
  const [tab, setTab] = useState<ReportTab>("timesheets");

  if (!meLoading && !isAdmin) return <Redirect to="/dashboard" />;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-region, #print-region * { visibility: visible; }
          #print-region { position: fixed; inset: 0; padding: 1.5rem; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />Print / Export
        </Button>
      </div>

      <div className="no-print flex rounded-xl border overflow-hidden w-fit bg-muted/30">
        <button
          onClick={() => setTab("timesheets")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === "timesheets" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
        >
          <Clock4 className="h-4 w-4" />Timesheets
        </button>
        <button
          onClick={() => setTab("time-off")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === "time-off" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
        >
          <Umbrella className="h-4 w-4" />Time Off Balances
        </button>
      </div>

      <div id="print-region">
        {tab === "timesheets" ? (
          <TimesheetsTab employees={employees} />
        ) : (
          <TimeOffBalancesTab employees={employees} />
        )}
      </div>
    </div>
  );
}
