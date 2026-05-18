import { useState, useRef } from "react";
import {
  useGetTimesheetReport,
  useGetTimeOffBalances,
  useListEmployees,
} from "@workspace/api-client-react";
import type { TimesheetEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronDown, ChevronUp, Clock4, Umbrella } from "lucide-react";
import { useMe } from "@/App";
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

// ─── Time Off Balances Tab ───────────────────────────────────────────────────
function TimeOffBalancesTab({ employees }: { employees: { id: number; name: string }[] | undefined }) {
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const employeeId = filterEmployee !== "all" ? parseInt(filterEmployee) : undefined;
  const { data: balances, isLoading } = useGetTimeOffBalances(employeeId ? { employeeId } : {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
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

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : !balances || balances.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No data available.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {balances.map((b) => {
            const pctUsed = b.allottedHours > 0 ? Math.min(100, (b.usedHours / b.allottedHours) * 100) : 0;
            const pctPlanned = b.allottedHours > 0 ? Math.min(100 - pctUsed, (b.plannedHours / b.allottedHours) * 100) : 0;
            const overBudget = b.usedPlusPlannedHours > b.allottedHours;
            return (
              <Card key={b.employeeId} className="overflow-hidden">
                <div className="h-1 w-full bg-muted overflow-hidden">
                  <div className="h-full flex">
                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctUsed}%` }} />
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${pctPlanned}%` }} />
                  </div>
                </div>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={b.employeeName} size="md" />
                      <div>
                        <p className="font-semibold">{b.employeeName}</p>
                        {b.department && <p className="text-xs text-muted-foreground">{b.department}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="text-center"><div className="text-lg font-bold">{fmtHours(b.allottedHours)}</div><div className="text-xs text-muted-foreground">Allotted</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-blue-600">{fmtHours(b.usedHours)}</div><div className="text-xs text-muted-foreground">Used</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-amber-500">{fmtHours(b.plannedHours)}</div><div className="text-xs text-muted-foreground">Planned</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-emerald-600">{fmtHours(b.usedPlusPlannedHours)}</div><div className="text-xs text-muted-foreground">Used + Planned</div></div>
                      <div className="text-center border-l pl-4">
                        <div className={`text-lg font-bold ${overBudget ? "text-destructive" : ""}`}>
                          {overBudget ? "0h" : fmtHours(b.remainingHours)}
                        </div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                        {overBudget && <Badge variant="destructive" className="text-[10px] mt-0.5">Over by {fmtHours(b.usedPlusPlannedHours - b.allottedHours)}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded bg-blue-500" /> Approved / Used</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-400" /> Pending / Planned</span>
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
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7 gap-1"><ChevronDown className="h-3 w-3" />Expand All</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7 gap-1"><ChevronUp className="h-3 w-3" />Collapse All</Button>
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
                    <EmployeeAvatar name={emp.employeeName} size="sm" />
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
