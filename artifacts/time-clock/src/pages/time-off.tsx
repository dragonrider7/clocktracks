import { useListTimeOffRequests, useReviewTimeOffRequest, getListTimeOffRequestsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

export default function TimeOff() {
  const { data: requests, isLoading } = useListTimeOffRequests();
  const reviewMutation = useReviewTimeOffRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleReview = (id: number, status: 'approved' | 'denied') => {
    reviewMutation.mutate({ id, data: { status, reviewedBy: 1 } }, { // Assuming admin ID 1 for simplified demo
      onSuccess: () => {
        toast({ title: `Request ${status}` });
        queryClient.invalidateQueries({ queryKey: getListTimeOffRequestsQueryKey() });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
      case 'denied': return <Badge variant="destructive">Denied</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Off Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
            ) : requests?.map(req => (
              <TableRow key={req.id}>
                <TableCell className="font-medium">{req.employeeName}</TableCell>
                <TableCell className="capitalize">{req.type}</TableCell>
                <TableCell>
                  {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>{getStatusBadge(req.status)}</TableCell>
                <TableCell className="text-right">
                  {req.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleReview(req.id, 'approved')}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleReview(req.id, 'denied')}>
                        <XCircle className="w-4 h-4 mr-1" /> Deny
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
