import { useState } from "react";
import {
  useListTimeOffRequests,
  useCreateTimeOffRequest,
  useReviewTimeOffRequest,
  useListEmployees,
  getListTimeOffRequestsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Plus } from "lucide-react";
import { useMe } from "@/App";

export default function TimeOff() {
  const { data: requests, isLoading } = useListTimeOffRequests();
  const { data: employees } = useListEmployees();
  const reviewMutation = useReviewTimeOffRequest();
  const createMutation = useCreateTimeOffRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { me, isAdmin } = useMe();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    employeeId: "",
    type: "vacation" as "vacation" | "sick" | "personal" | "other",
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
      {
        data: {
          employeeId: empId,
          type: newRequest.type,
          startDate: newRequest.startDate,
          endDate: newRequest.endDate,
          notes: newRequest.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Time off request submitted" });
          setIsRequestOpen(false);
          setNewRequest({ employeeId: "", type: "vacation", startDate: "", endDate: "", notes: "" });
          queryClient.invalidateQueries({ queryKey: getListTimeOffRequestsQueryKey() });
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const displayedRequests = isAdmin
    ? requests
    : requests?.filter((r) => r.employeeId === me?.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Time Off Requests</CardTitle>
        <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-request-time-off">
              <Plus className="w-4 h-4 mr-2" />
              Request Time Off
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {isAdmin && (
                <div>
                  <label className="text-sm font-medium">Employee</label>
                  <Select
                    value={newRequest.employeeId}
                    onValueChange={(v) => setNewRequest({ ...newRequest, employeeId: v })}
                  >
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={newRequest.type}
                  onValueChange={(v: typeof newRequest.type) =>
                    setNewRequest({ ...newRequest, type: v })
                  }
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    data-testid="input-start-date"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newRequest.startDate}
                    onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    data-testid="input-end-date"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newRequest.endDate}
                    onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  data-testid="input-notes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Any additional details..."
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmitRequest}
                disabled={
                  createMutation.isPending ||
                  !newRequest.startDate ||
                  !newRequest.endDate ||
                  (isAdmin && !newRequest.employeeId)
                }
                data-testid="button-submit-request"
              >
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 4} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : displayedRequests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 4} className="text-center text-muted-foreground py-8">
                  No time off requests yet.
                </TableCell>
              </TableRow>
            ) : (
              displayedRequests?.map((req) => (
                <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                  {isAdmin && (
                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                  )}
                  <TableCell className="capitalize">{req.type}</TableCell>
                  <TableCell>
                    {req.startDate} – {req.endDate}
                  </TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {req.notes || "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {req.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleReview(req.id, "approved")}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-approve-${req.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleReview(req.id, "denied")}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-deny-${req.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Deny
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
