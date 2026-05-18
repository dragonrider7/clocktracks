import { useState } from "react";
import {
  useListTimeEntries,
  useDeleteTimeEntry,
  useUpdateTimeEntry,
  useListEmployees,
  getListTimeEntriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Filter } from "lucide-react";
import { useMe } from "@/App";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editEntry, setEditEntry] = useState<{
    id: number;
    clockIn: string;
    clockOut: string;
  } | null>(null);

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
      { id: editEntry.id, data: { clockIn: editEntry.clockIn, clockOut: editEntry.clockOut || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Entry updated" });
          setEditEntry(null);
          invalidate();
        },
      }
    );
  };

  const formatDuration = (mins: number | null | undefined) => {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Log</CardTitle>
        <div className="flex flex-wrap gap-3 pt-2">
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
            placeholder="Start date"
          />
          <input
            type="date"
            data-testid="filter-end"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            placeholder="End date"
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
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 5} className="text-center text-muted-foreground py-8">
                  No time entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => (
                <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                  {isAdmin && <TableCell className="font-medium">{entry.employeeName}</TableCell>}
                  <TableCell>{new Date(entry.clockIn).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {new Date(entry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
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
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
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
