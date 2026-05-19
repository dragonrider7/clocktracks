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
import { Trash2, Pencil, Filter, PlusCircle } from "lucide-react";
import { useMe } from "@/contexts/me-context";

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
  } | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    clockInTime: "09:00",
    clockOutTime: "17:00",
    notes: "",
    hasClockOut: true,
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
      { id: editEntry.id, data: { clockIn: editEntry.clockIn, clockOut: editEntry.clockOut || undefined, notes: editEntry.notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Entry updated" });
          setEditEntry(null);
          invalidate();
        },
      }
    );
  };

  const handleAdd = () => {
    if (!newEntry.employeeId || !newEntry.date || !newEntry.clockInTime) return;
    const clockIn = `${newEntry.date}T${newEntry.clockInTime}:00`;
    const clockOut = newEntry.hasClockOut && newEntry.clockOutTime
      ? `${newEntry.date}T${newEntry.clockOutTime}:00`
      : undefined;

    createMutation.mutate(
      { data: { employeeId: parseInt(newEntry.employeeId), clockIn, clockOut, notes: newEntry.notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Time entry added" });
          setIsAddOpen(false);
          setNewEntry({ employeeId: "", date: new Date().toISOString().split("T")[0], clockInTime: "09:00", clockOutTime: "17:00", notes: "", hasClockOut: true });
          invalidate();
        },
      }
    );
  };

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
                  Add Past Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Past Time Entry</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">Employee</label>
                    <Select value={newEntry.employeeId} onValueChange={(v) => setNewEntry({ ...newEntry, employeeId: v })}>
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
                      value={newEntry.date}
                      onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Clock In Time</label>
                      <Input
                        type="time"
                        value={newEntry.clockInTime}
                        onChange={(e) => setNewEntry({ ...newEntry, clockInTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Clock Out Time</label>
                      <div className="space-y-1.5">
                        <Input
                          type="time"
                          value={newEntry.clockOutTime}
                          disabled={!newEntry.hasClockOut}
                          onChange={(e) => setNewEntry({ ...newEntry, clockOutTime: e.target.value })}
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!newEntry.hasClockOut}
                            onChange={(e) => setNewEntry({ ...newEntry, hasClockOut: !e.target.checked })}
                            className="rounded"
                          />
                          Still clocked in (no clock out)
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <Input
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      placeholder="e.g. Worked remotely"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleAdd}
                    disabled={!newEntry.employeeId || !newEntry.date || !newEntry.clockInTime || createMutation.isPending}
                  >
                    Add Entry
                  </Button>
                </div>
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
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
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
              entries?.map((entry) => (
                <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                  {isAdmin && <TableCell className="font-medium">{entry.employeeName}</TableCell>}
                  <TableCell>{new Date(entry.clockIn).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {new Date(entry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {entry.clockOut
                      ? new Date(entry.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell>{formatDuration(entry.totalMinutes)}</TableCell>
                  <TableCell>
                    {!entry.clockOut ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Completed</Badge>
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Time Entry</DialogTitle></DialogHeader>
          {editEntry && (
            <div className="space-y-4 pt-4">
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
                  placeholder="Optional notes"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleUpdate}
                disabled={!editEntry.clockIn || updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
