import { useState, useRef } from "react";
import {
  useGetTimesheetReport,
  useGetTimeOffBalances,
  useListEmployees,
} from "@workspace/api-client-react";
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

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date): string { return d.toISOString().split("T")[0]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getPresetRange(preset: Preset): { startDate: string; endDate: string } {
  const today = new Date();
  const thisMonday = getMondayOfWeek(today);
  switch (preset) {
    case "this-week": return { startDate: toDateStr(thisMonday), endDate: toDateStr(addDays(thisMonday, 6)) };
    case "last-week": { const lm = addDays(thisMonday, -7); return { startDate: toDateStr(lm), endDate: toDateStr(addDays(lm, 6)) }; }
    case "this-biweek": return { startDate: toDateStr(addDays(thisMonday, -7)), endDate: toDateStr(addDays(thisMonday, 6)) };
    case "last-biweek": return { startDate: toDateStr(addDays(thisMonday, -21)), endDate: toDateStr(addDays(thisMonday, -8)) };
    case "custom": return { startDate: toDateStr(thisMonday), endDate: toDateStr(addDays(thisMonday, 6)) };
  }
}

function fmtHours(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}
function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function fmtTime(iso: string): string { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso: string): string { return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }

// ──────────────────────────────────────────────
// Time Off Balances Tab
// ──────────────────────────────────────────────
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
              {employees?.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
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
            const pctPlanned = b.allottedHours > 0
              ? Math.min(100 - pctUsed, (b.plannedHours / b.allottedHours) * 100)
              : 0;
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
                      <div className="text-center">
                        <div className="text-lg font-bold">{fmtHours(b.allottedHours)}</div>
                        <div className="text-xs text-muted-foreground">Allotted</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{fmtHours(b.usedHours)}</div>
                        <div className="text-xs text-muted-foreground">Used</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-500">{fmtHours(b.plannedHours)}</div>
                        <div className="text-xs text-muted-foreground">Planned</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${overBudget ? "text-destructive" : "text-emerald-600"}`}>
                          {fmtHours(b.usedPlusPlannedHours)}
                        </div>
                        <div className="text-xs text-muted-foreground">Used + Planned</div>
                      </div>
                      <div className="text-center border-l pl-4">
                        <div className={`text-lg font-bold ${overBudget ? "text-destructive" : ""}`}>
                          {overBudget ? "0h" : fmtHours(b.remainingHours)}
                        </div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                        {overBudget && (
                          <Badge variant="destructive" className="text-[10px] mt-0.5">
                            Over by {fmtHours(b.usedPlusPlannedHours - b.allottedHours)}
                          </Badge>
                        )}
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
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded bg-muted border" /> Remaining</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Timesheets Tab
// ──────────────────────────────────────────────
function TimesheetsTab({ employees }: { employees: { id: number; name: string }[] | undefined }) {
  const [preset, setPreset] = useState<Preset>("this-week");
  const [customStart, setCustomStart] = useState(toDateStr(getMondayOfWeek(new Date())));
  const [customEnd, setCustomEnd] = useState(toDateStr(addDays(getMondayOfWeek(new Date()), 6)));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { startDate, endDate } = preset === "custom" ? { startDate: customStart, endDate: customEnd } : getPresetRange(preset);
  const employeeId = selectedEmployee !== "all" ? parseInt(selectedEmployee) : undefined;
  const { data: report, isLoading } = useGetTimesheetReport({ startDate, endDate, employeeId });

  const totalMinutes = report?.reduce((sum, e) => sum + e.totalMinutes, 0) ?? 0;
  const toggleExpand = (id: number) => setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : !report || report.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No time entries found for this period.</CardContent></Card>
      ) : (
        <>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7 gap-1"><ChevronDown className="h-3 w-3" />Expand All</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7 gap-1"><ChevronUp className="h-3 w-3" />Collapse All</Button>
          </div>

          {report.map((emp) => {
            const isExpanded = expandedIds.has(emp.employeeId);
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
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono">{fmtMinutes(emp.totalMinutes)}</Badge>
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
                          {emp.entries.map((entry) => (
                            <tr key={entry.id} className="border-t hover:bg-muted/20">
                              <td className="px-5 py-2 text-muted-foreground">{fmtDate(entry.clockIn)}</td>
                              <td className="px-5 py-2 font-mono">{fmtTime(entry.clockIn)}</td>
                              <td className="px-5 py-2 font-mono">
                                {entry.clockOut ? fmtTime(entry.clockOut) : <Badge variant="outline" className="text-xs">Still in</Badge>}
                              </td>
                              <td className="px-5 py-2 text-right font-mono">{entry.totalMinutes != null ? fmtMinutes(entry.totalMinutes) : "—"}</td>
                              <td className="px-5 py-2 text-muted-foreground text-xs">{entry.notes || "—"}</td>
                            </tr>
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
            <CardContent className="py-3 px-5 flex items-center justify-between">
              <span className="font-semibold">Total — All Employees</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">{report.length} employees</span>
                <Badge className="font-mono">{fmtMinutes(totalMinutes)}</Badge>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Reports Page
// ──────────────────────────────────────────────
export default function Reports() {
  const { isAdmin, isLoading: meLoading } = useMe();
  const { data: employees } = useListEmployees();
  const [tab, setTab] = useState<ReportTab>("timesheets");

  if (!meLoading && !isAdmin) return <Redirect to="/dashboard" />;

  const handlePrint = () => window.print();

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
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Export
        </Button>
      </div>

      <div className="no-print flex rounded-xl border overflow-hidden w-fit bg-muted/30">
        <button
          onClick={() => setTab("timesheets")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "timesheets" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <Clock4 className="h-4 w-4" />
          Timesheets
        </button>
        <button
          onClick={() => setTab("time-off")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "time-off" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <Umbrella className="h-4 w-4" />
          Time Off Balances
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
