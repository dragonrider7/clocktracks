import { useState } from "react";
import {
  useListTimeEntries,
  useDeleteTimeEntry,
  useUpdateTimeEntry,
  useCreateTimeEntry,
  useListEmployees,
  getListTimeEntriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Filter, PlusCircle, Timer } from "lucide-react";
import { useMe } from "@/contexts/me-context";
import { useRunningClock } from "@/hooks/use-running-clock";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(mins: number | null | undefined): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const TIME_OFF_LABELS: Record<string, string> = {
  pto: "PTO",
  sick: "Sick",
  bereavement: "Bereavement",
};

function EntryBadge({ kind, timeOffType }: { kind?: string | null; timeOffType?: string | null }) {
  if (!kind || kind === "work") {
    return <Badge variant="secondary">Worked</Badge>;
  }
  const label = timeOffType ? (TIME_OFF_LABELS[timeOffType] ?? timeOffType) : "Time Off";
  const colors: Record<string, string> = {
    pto: "bg-blue-100 text-blue-800 border-blue-200",
    sick: "bg-orange-100 text-orange-800 border-orange-200",
    bereavement: "bg-purple-100 text-purple-800 border-purple-200",
  };
  const cls = timeOffType ? (colors[timeOffType] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** Live duration cell for an active (not yet clocked-out) work entry. */
function ActiveDuration({ clockIn }: { clockIn: string }) {
  const elapsed = useRunningClock(clockIn);
  return (
    <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
      <Timer className="h-3 w-3" />
      {elapsed}
    </span>
  );
}

/** Identifies whether a clockIn timestamp falls on today (local time). */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface TimeEntry {
  id: number;
  employeeId: number;
  kind?: string | null;
  clockIn: string;
  clockOut?: string | null;
  totalMinutes?: number | null;
  notes?: string | null;
  employeeName?: string | null;
  timeOffType?: string | null;
}

/**
 * Banner showing the total hours accumulated today for a given employee
 * (completed sessions + the live active session).
 */
function TodaySummary({
  entries,
  employeeId,
}: {
  entries: TimeEntry[];
  employeeId: number | null;
}) {
  const todayWork = entries.filter(
    (e) =>
      e.kind === "work" &&
      isToday(e.clockIn) &&
      (employeeId == null || e.employeeId === employeeId),
  );

  const completedMins = todayWork
    .filter((e) => e.clockOut)
    .reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);

  const activeEntry = todayWork.find((e) => !e.clockOut) ?? null;
  const elapsed = useRunningClock(activeEntry?.clockIn ?? null, completedMins);

  if (todayWork.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm mb-3">
      <Timer className="h-4 w-4 text-emerald-600 shrink-0" />
      <span className="text-emerald-800">
        <span className="font-medium">Today's total:</span>{" "}
        <span className="font-bold">{elapsed}</span>
        {activeEntry && (
          <span className="text-emerald-600 ml-1">· session active</span>
        )}
      </span>
    </div>
  );
}

export default function TimeEntries() {
  const { isAdmin, me } = useMe();
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const params = {
    ...(isAdmin && filterEmployee !== "all" ? { employeeId: parseInt(filterEmployee) } : {}),
    ...(!isAdmin && me ? { employeeId: me.id } : {}),
    ...(filterStart ? { startDate: filterStart } : {}),
    ...(filterEnd ? { endDate: filterEnd } : {}),
  };

  const { data: entries, isLoading } = useListTimeEntries(params, {
    query: { queryKey: getListTimeEntriesQueryKey(params) },
  });
  const { data: employees } = useListEmployees();
  const deleteMutation = useDeleteTimeEntry();
  const updateMutation = useUpdateTimeEntry();
  const createMutation = useCreateTimeEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editEntry, setEditEntry] = useState<{
    id: number;
    clockIn: string;
    clockOut: string;
    notes: string;
    kind: string;
    timeOffType: string;
  } | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"work" | "time_off">("work");

  const [workEntry, setWorkEntry] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    clockInTime: "09:00",
    clockOutTime: "17:00",
    hasClockOut: true,
    notes: "",
  });

  const [timeOffEntry, setTimeOffEntry] = useState({
    employeeId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    timeOffType: "pto",
    hoursPerDay: "8",
    notes: "",
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey(params) });

  const handleDelete = (id: number) => {
    if (!confirm("Delete this time entry?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Entry deleted" });
        invalidate();
      },
    });
  };

  const handleUpdate = () => {
    if (!editEntry) return;
    updateMutation.mutate(
      {
        id: editEntry.id,
        data: {
          clockIn: editEntry.clockIn,
          clockOut: editEntry.clockOut || undefined,
          notes: editEntry.notes || undefined,
          kind: editEntry.kind as "work" | "time_off",
          timeOffType: editEntry.timeOffType || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Entry updated" });
          setEditEntry(null);
          invalidate();
        },
      }
    );
  };

  const handleAddWork = () => {
    if (!workEntry.employeeId || !workEntry.date || !workEntry.clockInTime) return;
    const clockIn = `${workEntry.date}T${workEntry.clockInTime}:00`;
    const clockOut = workEntry.hasClockOut && workEntry.clockOutTime
      ? `${workEntry.date}T${workEntry.clockOutTime}:00`
      : undefined;

    createMutation.mutate(
      { data: { employeeId: parseInt(workEntry.employeeId), kind: "work", clockIn, clockOut, notes: workEntry.notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Time entry added" });
          setIsAddOpen(false);
          setWorkEntry({ employeeId: "", date: new Date().toISOString().split("T")[0], clockInTime: "09:00", clockOutTime: "17:00", hasClockOut: true, notes: "" });
          invalidate();
        },
      }
    );
  };

  const handleAddTimeOff = () => {
    if (!timeOffEntry.employeeId || !timeOffEntry.startDate) return;
    const hours = parseInt(timeOffEntry.hoursPerDay) || 8;
    createMutation.mutate(
      {
        data: {
          employeeId: parseInt(timeOffEntry.employeeId),
          kind: "time_off",
          timeOffType: timeOffEntry.timeOffType as "pto" | "sick" | "bereavement",
          startDate: timeOffEntry.startDate,
          endDate: timeOffEntry.endDate || timeOffEntry.startDate,
          hoursPerDay: hours,
          notes: timeOffEntry.notes || undefined,
        },
      },
      {
        onSuccess: (data) => {
          const count = Array.isArray(data) ? data.length : 1;
          toast({ title: `${count} time-off ${count === 1 ? "entry" : "entries"} added` });
          setIsAddOpen(false);
          setTimeOffEntry({ employeeId: "", startDate: new Date().toISOString().split("T")[0], endDate: new Date().toISOString().split("T")[0], timeOffType: "pto", hoursPerDay: "8", notes: "" });
          invalidate();
        },
      }
    );
  };

  // Which employee's "Today" summary to show:
  // non-admin → always current user; admin → selected filter or null (show all)
  const summaryEmployeeId = isAdmin
    ? filterEmployee !== "all" ? parseInt(filterEmployee) : null
    : (me?.id ?? null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Time Log</CardTitle>
          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Time Entry</DialogTitle></DialogHeader>

                {/* Mode tabs */}
                <div className="flex rounded-lg border overflow-hidden mt-1">
                  <button
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === "work" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => setAddMode("work")}
                  >
                    Worked Time
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === "time_off" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => setAddMode("time_off")}
                  >
                    Time Off / PTO
                  </button>
                </div>

                {addMode === "work" ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">Employee</label>
                      <Select value={workEntry.employeeId} onValueChange={(v) => setWorkEntry({ ...workEntry, employeeId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees?.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={workEntry.date}
                        onChange={(e) => setWorkEntry({ ...workEntry, date: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Clock In</label>
                        <Input
                          type="time"
                          value={workEntry.clockInTime}
                          onChange={(e) => setWorkEntry({ ...workEntry, clockInTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Clock Out</label>
                        <div className="space-y-1.5">
                          <Input
                            type="time"
                            value={workEntry.clockOutTime}
                            disabled={!workEntry.hasClockOut}
                            onChange={(e) => setWorkEntry({ ...workEntry, clockOutTime: e.target.value })}
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!workEntry.hasClockOut}
                              onChange={(e) => setWorkEntry({ ...workEntry, hasClockOut: !e.target.checked })}
                              className="rounded"
                            />
                            Still clocked in
                          </label>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Input
                        value={workEntry.notes}
                        onChange={(e) => setWorkEntry({ ...workEntry, notes: e.target.value })}
                        placeholder="e.g. Worked remotely"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleAddWork}
                      disabled={!workEntry.employeeId || !workEntry.date || !workEntry.clockInTime || createMutation.isPending}
                    >
                      Add Entry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">Employee</label>
                      <Select value={timeOffEntry.employeeId} onValueChange={(v) => setTimeOffEntry({ ...timeOffEntry, employeeId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees?.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <Select value={timeOffEntry.timeOffType} onValueChange={(v) => setTimeOffEntry({ ...timeOffEntry, timeOffType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pto">PTO (Paid Time Off)</SelectItem>
                          <SelectItem value="sick">Sick Time</SelectItem>
                          <SelectItem value="bereavement">Bereavement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Start Date</label>
                        <Input
                          type="date"
                          value={timeOffEntry.startDate}
                          onChange={(e) => setTimeOffEntry({ ...timeOffEntry, startDate: e.target.value, endDate: timeOffEntry.endDate < e.target.value ? e.target.value : timeOffEntry.endDate })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">End Date</label>
                        <Input
                          type="date"
                          value={timeOffEntry.endDate}
                          min={timeOffEntry.startDate}
                          onChange={(e) => setTimeOffEntry({ ...timeOffEntry, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Hours Per Day</label>
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={timeOffEntry.hoursPerDay}
                        onChange={(e) => setTimeOffEntry({ ...timeOffEntry, hoursPerDay: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Input
                        value={timeOffEntry.notes}
                        onChange={(e) => setTimeOffEntry({ ...timeOffEntry, notes: e.target.value })}
                        placeholder="e.g. Family vacation"
                      />
                    </div>
                    {timeOffEntry.startDate && timeOffEntry.endDate && timeOffEntry.startDate <= timeOffEntry.endDate && (
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const start = new Date(timeOffEntry.startDate + "T00:00:00");
                          const end = new Date(timeOffEntry.endDate + "T00:00:00");
                          const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                          return `${days} ${days === 1 ? "day" : "days"} × ${timeOffEntry.hoursPerDay}h = ${days * (parseInt(timeOffEntry.hoursPerDay) || 8)}h total`;
                        })()}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleAddTimeOff}
                      disabled={!timeOffEntry.employeeId || !timeOffEntry.startDate || createMutation.isPending}
                    >
                      Add Time Off
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          {isAdmin && (
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[180px]" data-testid="filter-employee">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input
            type="date"
            data-testid="filter-start"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
          />
          <input
            type="date"
            data-testid="filter-end"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
          />
          {(filterEmployee !== "all" || filterStart || filterEnd) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterEmployee("all"); setFilterStart(""); setFilterEnd(""); }}>
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isLoading && entries && entries.length > 0 && (
          <TodaySummary entries={entries} employeeId={summaryEmployeeId} />
        )}
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Notes</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 6} className="text-center text-muted-foreground py-8">
                  No time entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => {
                const isActive = entry.kind === "work" && !entry.clockOut;
                return (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    {isAdmin && <TableCell className="font-medium">{entry.employeeName}</TableCell>}
                    <TableCell>{new Date(entry.clockIn).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.kind === "time_off"
                        ? "—"
                        : new Date(entry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.kind === "time_off"
                        ? "—"
                        : entry.clockOut
                          ? new Date(entry.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <ActiveDuration clockIn={entry.clockIn} />
                      ) : (
                        formatDuration(entry.totalMinutes)
                      )}
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
                      ) : (
                        <EntryBadge kind={entry.kind} timeOffType={entry.timeOffType} />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {entry.notes || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-edit-entry-${entry.id}`}
                            onClick={() =>
                              setEditEntry({
                                id: entry.id,
                                clockIn: toLocalInput(entry.clockIn),
                                clockOut: entry.clockOut ? toLocalInput(entry.clockOut) : "",
                                notes: entry.notes ?? "",
                                kind: entry.kind ?? "work",
                                timeOffType: entry.timeOffType ?? "",
                              })
                            }
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-entry-${entry.id}`}
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Time Entry</DialogTitle></DialogHeader>
          {editEntry && (
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={editEntry.kind}
                  onValueChange={(v) => setEditEntry({ ...editEntry, kind: v, timeOffType: v === "work" ? "" : editEntry.timeOffType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="work">Worked Time</SelectItem>
                    <SelectItem value="time_off">Time Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editEntry.kind === "time_off" && (
                <div>
                  <label className="text-sm font-medium">Time Off Type</label>
                  <Select
                    value={editEntry.timeOffType}
                    onValueChange={(v) => setEditEntry({ ...editEntry, timeOffType: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pto">PTO</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="bereavement">Bereavement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Clock In</label>
                <Input
                  type="datetime-local"
                  value={editEntry.clockIn}
                  onChange={(e) => setEditEntry({ ...editEntry, clockIn: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Clock Out</label>
                <Input
                  type="datetime-local"
                  value={editEntry.clockOut}
                  onChange={(e) => setEditEntry({ ...editEntry, clockOut: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={editEntry.notes}
                  onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleUpdate} disabled={updateMutation.isPending}>
                  Save
                </Button>
                <Button variant="outline" onClick={() => setEditEntry(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
