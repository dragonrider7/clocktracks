import { useState, useRef } from "react";
import { useGetTimesheetReport, useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronDown, ChevronUp } from "lucide-react";
import { useMe } from "@/App";
import { Redirect } from "wouter";

type Preset = "this-week" | "last-week" | "this-biweek" | "last-biweek" | "custom";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getPresetRange(preset: Preset): { startDate: string; endDate: string } {
  const today = new Date();
  const thisMonday = getMondayOfWeek(today);
  switch (preset) {
    case "this-week":
      return { startDate: toDateStr(thisMonday), endDate: toDateStr(addDays(thisMonday, 6)) };
    case "last-week": {
      const lastMon = addDays(thisMonday, -7);
      return { startDate: toDateStr(lastMon), endDate: toDateStr(addDays(lastMon, 6)) };
    }
    case "this-biweek": {
      const start = addDays(thisMonday, -7);
      return { startDate: toDateStr(start), endDate: toDateStr(addDays(thisMonday, 6)) };
    }
    case "last-biweek": {
      const start = addDays(thisMonday, -21);
      return { startDate: toDateStr(start), endDate: toDateStr(addDays(thisMonday, -8)) };
    }
    case "custom":
      return { startDate: toDateStr(thisMonday), endDate: toDateStr(addDays(thisMonday, 6)) };
  }
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function Reports() {
  const { isAdmin, isLoading: meLoading } = useMe();
  const { data: employees } = useListEmployees();

  const [preset, setPreset] = useState<Preset>("this-week");
  const [customStart, setCustomStart] = useState(toDateStr(getMondayOfWeek(new Date())));
  const [customEnd, setCustomEnd] = useState(toDateStr(addDays(getMondayOfWeek(new Date()), 6)));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  if (!meLoading && !isAdmin) return <Redirect to="/dashboard" />;

  const { startDate, endDate } =
    preset === "custom" ? { startDate: customStart, endDate: customEnd } : getPresetRange(preset);

  const employeeId = selectedEmployee !== "all" ? parseInt(selectedEmployee) : undefined;

  const { data: report, isLoading } = useGetTimesheetReport({ startDate, endDate, employeeId });

  const totalMinutes = report?.reduce((sum, e) => sum + e.totalMinutes, 0) ?? 0;

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(report?.map((e) => e.employeeId) ?? []));
  const collapseAll = () => setExpandedIds(new Set());

  const handlePrint = () => window.print();

  const presetLabel: Record<Preset, string> = {
    "this-week": "This Week",
    "last-week": "Last Week",
    "this-biweek": "This + Last Week",
    "last-biweek": "Previous Bi-Week",
    "custom": "Custom Range",
  };

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
        <div>
          <h1 className="text-2xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {startDate} — {endDate}
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Export
        </Button>
      </div>

      <Card className="no-print">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Period</label>
              <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
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
                  <input
                    type="date"
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End</label>
                  <input
                    type="date"
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="print-region" ref={printRef} className="space-y-4">
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold">TimeClock — Timesheet Report</h1>
          <p className="text-sm text-gray-600">
            Period: {startDate} — {endDate} &nbsp;|&nbsp; {presetLabel[preset]}
            {selectedEmployee !== "all" && employees && (
              <span> &nbsp;|&nbsp; Employee: {employees.find((e) => e.id === employeeId)?.name}</span>
            )}
          </p>
          <hr className="mt-3" />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !report || report.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No time entries found for this period.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="no-print flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse All
              </Button>
            </div>

            {report.map((emp) => {
              const isExpanded = expandedIds.has(emp.employeeId);
              return (
                <Card key={emp.employeeId} className="overflow-hidden">
                  <div
                    className="no-print flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => toggleExpand(emp.employeeId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {emp.employeeName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium">{emp.employeeName}</span>
                        {emp.department && (
                          <span className="text-xs text-muted-foreground ml-2">— {emp.department}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {fmtMinutes(emp.totalMinutes)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{emp.entries.length} entries</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  <div className="print:block hidden px-5 py-2 border-b flex items-center justify-between">
                    <span className="font-semibold">{emp.employeeName}</span>
                    <span className="font-mono text-sm">{fmtMinutes(emp.totalMinutes)} total</span>
                  </div>

                  {(isExpanded || true) && (
                    <div className={isExpanded ? "" : "hidden print:block"}>
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
                                    {entry.clockOut ? fmtTime(entry.clockOut) : (
                                      <Badge variant="outline" className="text-xs">Still in</Badge>
                                    )}
                                  </td>
                                  <td className="px-5 py-2 text-right font-mono">
                                    {entry.totalMinutes != null ? fmtMinutes(entry.totalMinutes) : "—"}
                                  </td>
                                  <td className="px-5 py-2 text-muted-foreground text-xs">{entry.notes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </div>
                  )}
                </Card>
              );
            })}

            <Card className="bg-muted/30">
              <CardContent className="py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Total — All Employees</div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{report.length} employees</span>
                    <Badge className="font-mono text-sm">{fmtMinutes(totalMinutes)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
