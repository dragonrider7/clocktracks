import { useState } from "react";
import {
  useListTimeOffRequests,
  useCreateTimeOffRequest,
  useReviewTimeOffRequest,
  useListEmployees,
  useGetTimeOffBalances,
  useListHolidays,
  useListTimeAdjustments,
  useCreateTimeAdjustment,
  useReviewTimeAdjustment,
  useListTimeEntries,
  getListTimeOffRequestsQueryKey,
  getListTimeAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import type { TimeOffRequest, Holiday, TimeAdjustmentRequest } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Plus, List, CalendarDays, ChevronLeft, ChevronRight, Gift, PlusCircle, Clock, ClipboardList } from "lucide-react";
import { useMe } from "@/contexts/me-context";
import { EmployeeAvatar } from "@/components/employee-avatar";

type TimeOffType = "vacation" | "pto" | "sick" | "bereavement" | "personal" | "other";
type ViewMode = "list" | "calendar" | "adjustments";

// ─── Time-off helpers ────────────────────────────────────────────────────────

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
    const m = h.recurrenceMonth!;
    const nth = h.recurrenceNth!;
    const dow = h.recurrenceWeekday!;
    const firstOfMonth = new Date(year, m - 1, 1);
    let day = (dow - firstOfMonth.getDay() + 7) % 7 + 1;
    day += (nth - 1) * 7;
    if (day > new Date(year, m, 0).getDate()) return null;
    return `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function holidaysOnDay(dateStr: string, holidays: Holiday[]): Holiday[] {
  const year = parseInt(dateStr.slice(0, 4));
  return holidays.filter((h) => computeHolidayDate(h, year) === dateStr);
}

function CalendarView({ requests, holidays }: { requests: TimeOffRequest[]; holidays: Holiday[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOffset = firstDay.getDay();
  const monthName = firstDay.toLocaleString("default", { month: "long" });
  const todayStr = toDateStr(today);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-sm">{monthName} {year}</span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-center text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted py-1.5 font-medium text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: firstOffset }).map((_, i) => (
          <div key={`e-${i}`} className="bg-background py-2 min-h-[56px]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayRequests = requestsOnDay(dateStr, requests);
          const dayHolidays = holidaysOnDay(dateStr, holidays);
          const isToday = dateStr === todayStr;
          return (
            <div key={day} className={`bg-background py-1.5 px-1 min-h-[56px] flex flex-col gap-0.5 ${isToday ? "ring-2 ring-inset ring-primary" : ""}`}>
              <span className={`text-xs font-medium mb-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>{day}</span>
              {dayHolidays.map((h) => (
                <span key={h.id} className="text-[10px] leading-tight rounded px-1 py-0.5 bg-amber-100 text-amber-800 truncate flex items-center gap-0.5">
                  <Gift className="h-2.5 w-2.5 shrink-0" />{h.name}
                </span>
              ))}
              {dayRequests.slice(0, 2).map((r) => (
                <span key={r.id} className={`text-[10px] leading-tight rounded px-1 py-0.5 flex items-center gap-1 truncate ${TYPE_COLORS[r.type] ?? TYPE_COLORS.other}`}>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[r.status] ?? "bg-gray-400"}`} />
                  {r.employeeName ?? TYPE_LABELS[r.type]}
                </span>
              ))}
              {dayRequests.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{dayRequests.length - 2}</span>
              )}
            </div>
          );
        })}
      </div>
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

function fmtHours(h: number) {
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

// ─── Adjustment helpers ──────────────────────────────────────────────────────

const ADJ_STATUS_BADGE: Record<string, React.ReactNode> = {
  pending: <Badge variant="secondary">Pending</Badge>,
  approved: <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>,
  denied: <Badge variant="destructive">Denied</Badge>,
};

const ADJ_TYPE_LABELS: Record<string, string> = {
  new: "Add Entry",
  edit: "Correct Entry",
  delete: "Remove Entry",
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function AdjustmentRow({ adj, onApprove, onDeny, isAdmin, isReviewing }: {
  adj: TimeAdjustmentRequest;
  onApprove?: (id: number) => void;
  onDeny?: (id: number, notes: string) => void;
  isAdmin: boolean;
  isReviewing: boolean;
}) {
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyNotes, setDenyNotes] = useState("");

  return (
    <TableRow>
      {isAdmin && (
        <TableCell>
          <div className="flex items-center gap-2">
            <EmployeeAvatar name={adj.employeeName ?? "?"} imageUrl={adj.imageUrl} size="sm" />
            <span className="font-medium text-sm">{adj.employeeName ?? "—"}</span>
          </div>
        </TableCell>
      )}
      <TableCell>
        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border ${
          adj.requestType === "new" ? "bg-blue-50 text-blue-700 border-blue-200" :
          adj.requestType === "edit" ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-red-50 text-red-700 border-red-200"
        }`}>
          {ADJ_TYPE_LABELS[adj.requestType] ?? adj.requestType}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="space-y-0.5">
          {adj.requestedDate && <div>Date: {adj.requestedDate}</div>}
          {adj.requestedClockIn && <div>In: {formatDateTime(adj.requestedClockIn)}</div>}
          {adj.requestedClockOut && <div>Out: {formatDateTime(adj.requestedClockOut)}</div>}
          {!adj.requestedDate && !adj.requestedClockIn && !adj.requestedClockOut && <span>—</span>}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{adj.reason || "—"}</TableCell>
      <TableCell>{ADJ_STATUS_BADGE[adj.status] ?? <Badge variant="outline">{adj.status}</Badge>}</TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{adj.adminNotes || "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(adj.createdAt).toLocaleDateString()}
      </TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {adj.status === "pending" && (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 gap-1" onClick={() => onApprove?.(adj.id)} disabled={isReviewing}>
                <CheckCircle className="h-3.5 w-3.5" />Approve
              </Button>
              <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-1" disabled={isReviewing}>
                    <XCircle className="h-3.5 w-3.5" />Deny
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Deny Adjustment Request</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">Optionally add a note explaining why this request is being denied.</p>
                    <Textarea placeholder="Reason for denial (optional)..." value={denyNotes} onChange={(e) => setDenyNotes(e.target.value)} />
                    <Button variant="destructive" className="w-full" onClick={() => { onDeny?.(adj.id, denyNotes); setDenyOpen(false); setDenyNotes(""); }}>
                      Deny Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TimeOff() {
  const { data: requests, isLoading } = useListTimeOffRequests();
  const { data: employees } = useListEmployees();
  const { data: holidays = [] } = useListHolidays();
  const reviewMutation = useReviewTimeOffRequest();
  const createMutation = useCreateTimeOffRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { me, isAdmin } = useMe();

  const [view, setView] = useState<ViewMode>("list");
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    employeeId: "",
    type: "pto" as TimeOffType,
    startDate: "",
    endDate: "",
    notes: "",
  });

  // Adjustment state
  const adjParams = isAdmin ? {} : { employeeId: me?.id };
  const { data: adjustments, isLoading: adjLoading } = useListTimeAdjustments(adjParams, {
    query: { queryKey: getListTimeAdjustmentsQueryKey(adjParams), enabled: isAdmin || !!me?.id },
  });
  const entryParams = me ? { employeeId: me.id } : { employeeId: 0 };
  const { data: myEntries } = useListTimeEntries(entryParams, {
    query: { enabled: !!me, queryKey: ["time-entries", me?.id] },
  });
  const reviewAdjMutation = useReviewTimeAdjustment();
  const createAdjMutation = useCreateTimeAdjustment();
  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [newAdj, setNewAdj] = useState({
    requestType: "edit" as "new" | "edit" | "delete",
    timeEntryId: "",
    requestedDate: "",
    requestedClockIn: "",
    requestedClockOut: "",
    reason: "",
  });

  const invalidateAdj = () => queryClient.invalidateQueries({ queryKey: getListTimeAdjustmentsQueryKey(adjParams) });

  // Time-off handlers
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

  // Adjustment handlers
  const handleAdjApprove = (id: number) => {
    if (!me) return;
    reviewAdjMutation.mutate(
      { id, data: { status: "approved", reviewedBy: me.id } },
      {
        onSuccess: () => { toast({ title: "Request approved" }); invalidateAdj(); },
        onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
      }
    );
  };

  const handleAdjDeny = (id: number, adminNotes: string) => {
    if (!me) return;
    reviewAdjMutation.mutate(
      { id, data: { status: "denied", reviewedBy: me.id, adminNotes: adminNotes || undefined } },
      {
        onSuccess: () => { toast({ title: "Request denied" }); invalidateAdj(); },
        onError: () => toast({ title: "Failed to deny", variant: "destructive" }),
      }
    );
  };

  const handleSubmitAdj = () => {
    if (!me) return;
    const entryId = newAdj.timeEntryId ? parseInt(newAdj.timeEntryId) : undefined;
    const clockIn = newAdj.requestedDate && newAdj.requestedClockIn
      ? `${newAdj.requestedDate}T${newAdj.requestedClockIn}:00`
      : undefined;
    const clockOut = newAdj.requestedDate && newAdj.requestedClockOut
      ? `${newAdj.requestedDate}T${newAdj.requestedClockOut}:00`
      : undefined;
    createAdjMutation.mutate(
      { data: { employeeId: me.id, requestType: newAdj.requestType, timeEntryId: entryId, requestedDate: newAdj.requestedDate || undefined, requestedClockIn: clockIn, requestedClockOut: clockOut, reason: newAdj.reason || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Adjustment request submitted" });
          setIsAdjOpen(false);
          setNewAdj({ requestType: "edit", timeEntryId: "", requestedDate: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
          invalidateAdj();
        },
        onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
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
  const pendingOffCount = requests?.filter((r) => r.status === "pending" && (isAdmin || r.employeeId === me?.id)).length ?? 0;
  const pendingAdjCount = adjustments?.filter((a) => a.status === "pending").length ?? 0;

  const timeOffDialog = (
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

  const adjDialog = (
    <Dialog open={isAdjOpen} onOpenChange={setIsAdjOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><PlusCircle className="h-4 w-4" />Request Correction</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Time Correction</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Type of Request</label>
            <Select value={newAdj.requestType} onValueChange={(v: "new" | "edit" | "delete") => setNewAdj({ ...newAdj, requestType: v, timeEntryId: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Add a missing entry</SelectItem>
                <SelectItem value="edit">Correct an existing entry</SelectItem>
                <SelectItem value="delete">Remove an incorrect entry</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(newAdj.requestType === "edit" || newAdj.requestType === "delete") && (
            <div>
              <label className="text-sm font-medium">Which entry?</label>
              <Select value={newAdj.timeEntryId} onValueChange={(v) => setNewAdj({ ...newAdj, timeEntryId: v })}>
                <SelectTrigger><SelectValue placeholder="Select entry" /></SelectTrigger>
                <SelectContent>
                  {myEntries?.slice().reverse().map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {new Date(e.clockIn).toLocaleDateString()} —{" "}
                      {new Date(e.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {e.clockOut ? ` to ${new Date(e.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " (active)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {newAdj.requestType !== "delete" && (
            <>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={newAdj.requestedDate} onChange={(e) => setNewAdj({ ...newAdj, requestedDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Clock In Time</label>
                  <Input type="time" value={newAdj.requestedClockIn} onChange={(e) => setNewAdj({ ...newAdj, requestedClockIn: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Clock Out Time</label>
                  <Input type="time" value={newAdj.requestedClockOut} onChange={(e) => setNewAdj({ ...newAdj, requestedClockOut: e.target.value })} />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium">Reason / Notes</label>
            <Textarea placeholder="Explain what needs to be corrected and why..." value={newAdj.reason} onChange={(e) => setNewAdj({ ...newAdj, reason: e.target.value })} />
          </div>
          <Button className="w-full" onClick={handleSubmitAdj} disabled={createAdjMutation.isPending || !newAdj.reason}>
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
          <div className="flex items-center gap-3">
            <CardTitle>
              {view === "adjustments" ? "Time Adjustments" : "Time Off Requests"}
            </CardTitle>
            {view !== "adjustments" && pendingOffCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5 border border-amber-200 font-medium">
                {pendingOffCount} pending
              </span>
            )}
            {view === "adjustments" && pendingAdjCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5 border border-amber-200 font-medium">
                {pendingAdjCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <List className="h-3.5 w-3.5" />Requests
              </button>
              <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <CalendarDays className="h-3.5 w-3.5" />Calendar
              </button>
              <button onClick={() => setView("adjustments")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${view === "adjustments" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <ClipboardList className="h-3.5 w-3.5" />
                Adjustments
                {pendingAdjCount > 0 && view !== "adjustments" && (
                  <span className="ml-1 h-4 min-w-[16px] px-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingAdjCount}
                  </span>
                )}
              </button>
            </div>
            {view === "adjustments" ? (!isAdmin ? adjDialog : null) : timeOffDialog}
          </div>
        </CardHeader>

        <CardContent>
          {view === "calendar" ? (
            isLoading
              ? <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
              : <CalendarView requests={calendarRequests} holidays={holidays} />
          ) : view === "adjustments" ? (
            adjLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : adjustments?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {isAdmin ? "No adjustment requests yet." : "You have no time adjustment requests."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Requested Times</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin Notes</TableHead>
                    <TableHead>Submitted</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments?.map((adj) => (
                    <AdjustmentRow
                      key={adj.id}
                      adj={adj}
                      onApprove={handleAdjApprove}
                      onDeny={handleAdjDeny}
                      isAdmin={isAdmin}
                      isReviewing={reviewAdjMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            )
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
