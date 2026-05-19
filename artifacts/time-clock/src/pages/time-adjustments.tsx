import { useState } from "react";
import {
  useListTimeAdjustments,
  useCreateTimeAdjustment,
  useReviewTimeAdjustment,
  useListTimeEntries,
  getListTimeAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import type { TimeAdjustmentRequest } from "@workspace/api-client-react";
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
import { CheckCircle, XCircle, PlusCircle, Clock } from "lucide-react";
import { useMe } from "@/contexts/me-context";
import { EmployeeAvatar } from "@/components/employee-avatar";

const STATUS_BADGE: Record<string, React.ReactNode> = {
  pending: <Badge variant="secondary">Pending</Badge>,
  approved: <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>,
  denied: <Badge variant="destructive">Denied</Badge>,
};

const TYPE_LABELS: Record<string, string> = {
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
          {TYPE_LABELS[adj.requestType] ?? adj.requestType}
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
      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
        {adj.reason || "—"}
      </TableCell>
      <TableCell>{STATUS_BADGE[adj.status] ?? <Badge variant="outline">{adj.status}</Badge>}</TableCell>
      {adj.adminNotes && <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{adj.adminNotes}</TableCell>}
      {!adj.adminNotes && <TableCell className="text-muted-foreground text-sm">—</TableCell>}
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(adj.createdAt).toLocaleDateString()}
      </TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {adj.status === "pending" && (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700 gap-1"
                onClick={() => onApprove?.(adj.id)}
                disabled={isReviewing}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1"
                    disabled={isReviewing}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deny
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Deny Adjustment Request</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Optionally add a note explaining why this request is being denied.
                    </p>
                    <Textarea
                      placeholder="Reason for denial (optional)..."
                      value={denyNotes}
                      onChange={(e) => setDenyNotes(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        onDeny?.(adj.id, denyNotes);
                        setDenyOpen(false);
                        setDenyNotes("");
                      }}
                    >
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

export default function TimeAdjustments() {
  const { me, isAdmin } = useMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = isAdmin ? {} : { employeeId: me?.id };
  const { data: adjustments, isLoading } = useListTimeAdjustments(params, {
    query: { queryKey: getListTimeAdjustmentsQueryKey(params), enabled: isAdmin || !!me?.id },
  });

  const entryParams = me ? { employeeId: me.id } : { employeeId: 0 };
  const { data: myEntries } = useListTimeEntries(entryParams, {
    query: { enabled: !!me, queryKey: ["time-entries", me?.id] },
  });

  const reviewMutation = useReviewTimeAdjustment();
  const createMutation = useCreateTimeAdjustment();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newReq, setNewReq] = useState({
    requestType: "edit" as "new" | "edit" | "delete",
    timeEntryId: "",
    requestedDate: "",
    requestedClockIn: "",
    requestedClockOut: "",
    reason: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTimeAdjustmentsQueryKey(params) });

  const handleApprove = (id: number) => {
    if (!me) return;
    reviewMutation.mutate(
      { id, data: { status: "approved", reviewedBy: me.id } },
      {
        onSuccess: () => { toast({ title: "Request approved" }); invalidate(); },
        onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
      }
    );
  };

  const handleDeny = (id: number, adminNotes: string) => {
    if (!me) return;
    reviewMutation.mutate(
      { id, data: { status: "denied", reviewedBy: me.id, adminNotes: adminNotes || undefined } },
      {
        onSuccess: () => { toast({ title: "Request denied" }); invalidate(); },
        onError: () => toast({ title: "Failed to deny", variant: "destructive" }),
      }
    );
  };

  const handleSubmit = () => {
    if (!me) return;
    const entryId = newReq.timeEntryId ? parseInt(newReq.timeEntryId) : undefined;
    const clockIn = newReq.requestedDate && newReq.requestedClockIn
      ? `${newReq.requestedDate}T${newReq.requestedClockIn}:00`
      : undefined;
    const clockOut = newReq.requestedDate && newReq.requestedClockOut
      ? `${newReq.requestedDate}T${newReq.requestedClockOut}:00`
      : undefined;

    createMutation.mutate(
      {
        data: {
          employeeId: me.id,
          requestType: newReq.requestType,
          timeEntryId: entryId,
          requestedDate: newReq.requestedDate || undefined,
          requestedClockIn: clockIn,
          requestedClockOut: clockOut,
          reason: newReq.reason || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Adjustment request submitted" });
          setIsNewOpen(false);
          setNewReq({ requestType: "edit", timeEntryId: "", requestedDate: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
          invalidate();
        },
        onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
      }
    );
  };

  const pendingCount = adjustments?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>Time Adjustment Requests</CardTitle>
              {pendingCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5 border border-amber-200 font-medium">
                  {pendingCount} pending
                </span>
              )}
            </div>
            {!isAdmin && (
              <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Request Correction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Request Time Correction</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">Type of Request</label>
                      <Select
                        value={newReq.requestType}
                        onValueChange={(v: "new" | "edit" | "delete") => setNewReq({ ...newReq, requestType: v, timeEntryId: "" })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Add a missing entry</SelectItem>
                          <SelectItem value="edit">Correct an existing entry</SelectItem>
                          <SelectItem value="delete">Remove an incorrect entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(newReq.requestType === "edit" || newReq.requestType === "delete") && (
                      <div>
                        <label className="text-sm font-medium">Which entry?</label>
                        <Select
                          value={newReq.timeEntryId}
                          onValueChange={(v) => setNewReq({ ...newReq, timeEntryId: v })}
                        >
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

                    {newReq.requestType !== "delete" && (
                      <>
                        <div>
                          <label className="text-sm font-medium">Date</label>
                          <Input
                            type="date"
                            value={newReq.requestedDate}
                            onChange={(e) => setNewReq({ ...newReq, requestedDate: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium">Clock In Time</label>
                            <Input
                              type="time"
                              value={newReq.requestedClockIn}
                              onChange={(e) => setNewReq({ ...newReq, requestedClockIn: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Clock Out Time</label>
                            <Input
                              type="time"
                              value={newReq.requestedClockOut}
                              onChange={(e) => setNewReq({ ...newReq, requestedClockOut: e.target.value })}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-sm font-medium">Reason / Notes</label>
                      <Textarea
                        placeholder="Explain what needs to be corrected and why..."
                        value={newReq.reason}
                        onChange={(e) => setNewReq({ ...newReq, reason: e.target.value })}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleSubmit}
                      disabled={createMutation.isPending || !newReq.reason}
                    >
                      Submit Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                    isAdmin={isAdmin}
                    isReviewing={reviewMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
