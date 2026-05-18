import { useListTimeEntries } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function TimeEntries() {
  const { data: entries, isLoading } = useListTimeEntries();

  const formatDuration = (mins: number | null | undefined) => {
    if (!mins) return "-";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Log</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : entries?.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.employeeName}</TableCell>
                <TableCell>{new Date(entry.clockIn).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell>{entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                <TableCell>{formatDuration(entry.totalMinutes)}</TableCell>
                <TableCell>
                  {!entry.clockOut ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Completed</Badge>
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
