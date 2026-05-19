import { useState } from "react";
import {
  useListTimeOffRequests,
  useCreateTimeOffRequest,
  useReviewTimeOffRequest,
  useListEmployees,
  useGetTimeOffBalances,
  useListHolidays,
  getListTimeOffRequestsQueryKey,
} from "@workspace/api-client-react";
import type { TimeOffRequest, Holiday } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Plus, List, CalendarDays, ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { useMe } from "@/contexts/me-context";

type TimeOffType = "vacation" | "pto" | "sick" | "bereavement" | "personal" | "other";

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  pto: "PTO",
  sick: "Sick Day",
  bereavement: "Bereavement",
  personal: "Personal",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-800 border-blue-200",
  pto: "bg-sky-100 text-sky-800 border-sky-200",
  sick: "bg-red-100 text-red-800 border-red-200",
  bereavement: "bg-gray-100 text-gray-800 border-gray-300",
  personal: "bg-purple-100 text-purple-800 border-purple-200",
  other: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const STATUS_DOT: Record<string, string> = {
  approved: "bg-green-500",
  pending: "bg-amber-400",
  denied: "bg-red-400",
};

function toDateStr(d: Date): string { return d.toISOString().split("T")[0]; }

function requestsOnDay(dateStr: string, requests: TimeOffRequest[]): TimeOffRequest[] {
  return requests.filter((r) => r.startDate <= dateStr && r.endDate >= dateStr);
}

function computeHolidayDate(h: Holiday, year: number): string | null {
  if (h.recurrenceType === "none") return h.date ?? null;
  if (h.recurrenceType === "fixed") {
    const m = h.recurrenceMonth!;
    const d = h.recurrenceDayOfMonth!;
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (h.recurrenceType === "nth_weekday") {
    const month = h.recurrenceMonth!;
    const targetWd = h.recurrenceWeekday!;
    const nth = h.recurrenceNth!;
    if (nth === -1) {
      const lastDay = new Date(year, month, 0).getDate();
      for (let d = lastDay; d >= 1; d--) {
        if (new Date(year, month - 1, d).getDay() === targetWd) {
          return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
      }
    } else {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, month - 1, d);
        if (dt.getMonth() !== month - 1) break;
        if (dt.getDay() === targetWd) {
          count++;
          if (count === nth) {
            return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          }
        }
      }
    }
  }
  return null;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function CalendarView({ requests, holidays }: { requests: TimeOffRequest[]; holidays: Holiday[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstOffset = firstDay.getDay();
  const rows = Math.ceil((firstOffset + lastDay.getDate()) / 7);
  const todayStr = toDateStr(today);

  // Pre-compute holiday dates for this month
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const holidaysByDate = new Map<string, Holiday[]>();
  for (const h of holidays) {
    const d = computeHolidayDate(h, year);
    if (d && d.startsWith(monthPrefix)) {
      if (!holidaysByDate.has(d)) holidaysByDate.set(d, []);
      holidaysByDate.get(d)!.push(h);
    }
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-base">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {DAY_LABELS.map((d) => (
          <div key={d} className="bg-muted/60 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
        {Array.from({ length: rows * 7 }, (_, i) => {
          const dayNum = i - firstOffset + 1;
          const isValid = dayNum >= 1 && dayNum <= lastDay.getDate();
          if (!isValid) return <div key={i} className="bg-background min-h-[72px]" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const dayRequests = requestsOnDay(dateStr, requests);
          const dayHolidays = holidaysByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isHoliday = dayHolidays.length > 0;
          return (
            <div key={i} className={`bg-background min-h-[72px] p-1.5 ${isToday ? "ring-2 ring-inset ring-primary/40" : ""} ${isHoliday ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
              <span className={`text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {dayNum}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayHolidays.map((h) => (
                  <div key={`h-${h.id}`} title={h.name}
                    className="flex items-center gap-1 rounded text-[10px] leading-tight px-1 py-0.5 border truncate bg-amber-100 text-amber-800 border-amber-300">
                    <Gift className="h-2 w-2 shrink-0" />
                    <span className="truncate font-medium">{h.name}</span>
                  </div>
                ))}
                {dayRequests.slice(0, 3 - dayHolidays.length).map((req) => (
                  <div key={req.id} title={`${req.employeeName ?? "Employee"} — ${TYPE_LABELS[req.type] ?? req.type} (${req.status})`}
                    className={`flex items-center gap-1 rounded text-[10px] leading-tight px-1 py-0.5 border truncate ${TYPE_COLORS[req.type] ?? TYPE_COLORS.other}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[req.status] ?? "bg-gray-400"}`} />
                    <span className="truncate">{req.employeeName?.split(" ")[0] ?? "?"}</span>
                  </div>
                ))}
                {(dayRequests.length + dayHolidays.length) > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayRequests.length + dayHolidays.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="text-xs px-2 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
          <Gift className="h-3 w-3" /> Holiday
        </span>
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{TYPE_LABELS[type] ?? type}</span>
        ))}
      </div>
    </div>
  );
}

function fmtHours(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

function BalanceWidget({ employeeId }: { employeeId: number | undefined }) {
  const { data: balances, isLoading } = useGetTimeOffBalances(
    employeeId ? { employeeId } : {},
    { query: { enabled: !!employeeId, queryKey: [] as unknown[] } },
  );
  const b = balances?.[0];

  if (isLoading) return <div className="h-16 animate-pulse bg-muted rounded-xl" />;
  if (!b) return null;

  const allotted = b.allottedHours;
  const pctUsed = allotted > 0 ? Math.min(100, (b.usedHours / allotted) * 100) : 0;
  const pctPlanned = allotted > 0 ? Math.min(100 - pctUsed, (b.plannedHours / allotted) * 100) : 0;
  const overBudget = b.usedPlusPlannedHours > allotted;

  const sickAllotted = b.sickTimeAllotmentHours;
  const sickPctUsed = sickAllotted > 0 ? Math.min(100, (b.sickUsedHours / sickAllotted) * 100) : 0;
  const sickPctPlanned = sickAllotted > 0 ? Math.min(100 - sickPctUsed, (b.sickPlannedHours / sickAllotted) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-muted overflow-hidden">
          <div className="h-full flex">
            <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctUsed}%` }} />
            <div className="bg-amber-400 h-full transition-all" style={{ width: `${pctPlanned}%` }} />
          </div>
        </div>
        <CardContent className="py-3 px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm font-semibold text-muted-foreground">PTO / Vacation Balance</span>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="text-center">
                <div className="text-base font-bold">{fmtHours(allotted)}</div>
                <div className="text-xs text-muted-foreground">Allotted</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-blue-600">{fmtHours(b.usedHours)}</div>
                <div className="text-xs text-muted-foreground">Used</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-amber-500">{fmtHours(b.plannedHours)}</div>
                <div className="text-xs text-muted-foreground">Planned</div>
              </div>
              <div className="text-center border-l pl-4">
                <div className={`text-base font-bold ${overBudget ? "text-destructive" : "text-emerald-600"}`}>
                  {overBudget ? `−${fmtHours(b.usedPlusPlannedHours - allotted)}` : fmtHours(b.remainingHours)}
                </div>
                <div className="text-xs text-muted-foreground">{overBudget ? "Over budget" : "Remaining"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-muted overflow-hidden">
          <div className="h-full flex">
            <div className="bg-red-400 h-full transition-all" style={{ width: `${sickPctUsed}%` }} />
            <div className="bg-rose-200 h-full transition-all" style={{ width: `${sickPctPlanned}%` }} />
          </div>
        </div>
        <CardContent className="py-3 px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-sm font-semibold text-muted-foreground">Sick Time Balance</span>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bereavement is unlimited — tracked separately</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="text-center">
                <div className="text-base font-bold">{fmtHours(sickAllotted)}</div>
                <div className="text-xs text-muted-foreground">Allotted</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-red-500">{fmtHours(b.sickUsedHours)}</div>
                <div className="text-xs text-muted-foreground">Used</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-rose-400">{fmtHours(b.sickPlannedHours)}</div>
                <div className="text-xs text-muted-foreground">Planned</div>
              </div>
              <div className="text-center border-l pl-4">
                <div className={`text-base font-bold ${b.sickRemainingHours <= 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {fmtHours(b.sickRemainingHours)}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs border ${TYPE_COLORS[type] ?? TYPE_COLORS.other}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export default function TimeOff() {
  const { data: requests, isLoading } = useListTimeOffRequests();
  const { data: employees } = useListEmployees();
  const { data: holidays = [] } = useListHolidays();
  const reviewMutation = useReviewTimeOffRequest();
  const createMutation = useCreateTimeOffRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { me, isAdmin } = useMe();

  const [view, setView] = useState<"list" | "calendar">("list");
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    employeeId: "",
    type: "pto" as TimeOffType,
    startDate: "",
    endDate: "",
    notes: "",
  });

  const handleReview = (id: number, status: "approved" | "denied") => {
    if (!me) return;
    reviewMutation.mutate(
      { id, data: { status, reviewedBy: me.id } },
      {
        onSuccess: () => {
          toast({ title: `Request ${status}` });
          queryClient.invalidateQueries({ queryKey: getListTimeOffRequestsQueryKey() });
        },
      }
    );
  };

  const handleSubmitRequest = () => {
    const empId = isAdmin ? parseInt(newRequest.employeeId) : me?.id;
    if (!empId || !newRequest.startDate || !newRequest.endDate) return;
    createMutation.mutate(
      { data: { employeeId: empId, type: newRequest.type, startDate: newRequest.startDate, endDate: newRequest.endDate, notes: newRequest.notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Time off request submitted" });
          setIsRequestOpen(false);
          setNewRequest({ employeeId: "", type: "pto", startDate: "", endDate: "", notes: "" });
          queryClient.invalidateQueries({ queryKey: getListTimeOffRequestsQueryKey() });
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
      case "denied": return <Badge variant="destructive">Denied</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const displayedRequests = isAdmin ? requests : requests?.filter((r) => r.employeeId === me?.id);
  const calendarRequests = isAdmin ? (requests ?? []) : (requests?.filter((r) => r.employeeId === me?.id) ?? []);

  const requestDialog = (
    <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-request-time-off"><Plus className="w-4 h-4 mr-2" />Request Time Off</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Time Off</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          {isAdmin && (
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select value={newRequest.employeeId} onValueChange={(v) => setNewRequest({ ...newRequest, employeeId: v })}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map((emp) => <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={newRequest.type} onValueChange={(v: TimeOffType) => setNewRequest({ ...newRequest, type: v })}>
              <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pto">PTO (Paid Time Off)</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Day</SelectItem>
                <SelectItem value="bereavement">Bereavement</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <input type="date" data-testid="input-start-date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRequest.startDate} onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <input type="date" data-testid="input-end-date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRequest.endDate} onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea data-testid="input-notes" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Any additional details..." value={newRequest.notes} onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })} />
          </div>
          <Button className="w-full" onClick={handleSubmitRequest} disabled={createMutation.isPending || !newRequest.startDate || !newRequest.endDate || (isAdmin && !newRequest.employeeId)} data-testid="button-submit-request">
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <BalanceWidget employeeId={me?.id} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle>Time Off Requests</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <List className="h-3.5 w-3.5" />List
              </button>
              <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <CalendarDays className="h-3.5 w-3.5" />Calendar
              </button>
            </div>
            {requestDialog}
          </div>
        </CardHeader>
        <CardContent>
          {view === "calendar" ? (
            isLoading ? <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
              : <CalendarView requests={calendarRequests} holidays={holidays} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Employee</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center">Loading...</TableCell></TableRow>
                ) : displayedRequests?.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center text-muted-foreground py-8">No time off requests yet.</TableCell></TableRow>
                ) : (
                  displayedRequests?.map((req) => {
                    const start = new Date(req.startDate + "T00:00:00");
                    const end = new Date(req.endDate + "T00:00:00");
                    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                    return (
                      <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                        {isAdmin && <TableCell className="font-medium">{req.employeeName}</TableCell>}
                        <TableCell><TypeBadge type={req.type} /></TableCell>
                        <TableCell className="text-sm">{req.startDate === req.endDate ? req.startDate : `${req.startDate} – ${req.endDate}`}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{days}d / {days * 8}h</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{req.notes || "—"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {req.status === "pending" && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleReview(req.id, "approved")} disabled={reviewMutation.isPending} data-testid={`button-approve-${req.id}`}>
                                  <CheckCircle className="w-4 h-4 mr-1" />Approve
                                </Button>
                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleReview(req.id, "denied")} disabled={reviewMutation.isPending} data-testid={`button-deny-${req.id}`}>
                                  <XCircle className="w-4 h-4 mr-1" />Deny
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
