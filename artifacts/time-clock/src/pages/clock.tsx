import { useState } from "react";
import { useListEmployees, useListTimeEntries, useClockIn, useClockOut, getListTimeEntriesQueryKey, getGetDashboardStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Clock() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading: loadingEmployees } = useListEmployees();
  
  // Get today's open entries for the selected employee to know if they are clocked in
  const { data: recentEntries } = useListTimeEntries(
    { employeeId: selectedEmployee ? parseInt(selectedEmployee) : undefined },
    { query: { enabled: !!selectedEmployee } }
  );

  const activeEntry = recentEntries?.find(e => !e.clockOut);
  const isClockedIn = !!activeEntry;

  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const handleClockAction = () => {
    if (!selectedEmployee) return;
    const empId = parseInt(selectedEmployee);

    if (isClockedIn && activeEntry) {
      clockOutMutation.mutate({ id: activeEntry.id, data: {} }, {
        onSuccess: () => {
          toast({ title: "Clocked Out Successfully", description: "Your time has been recorded." });
          queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey({ employeeId: empId }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatusQueryKey() });
        }
      });
    } else {
      clockInMutation.mutate({ data: { employeeId: empId } }, {
        onSuccess: () => {
          toast({ title: "Clocked In Successfully", description: "Have a great shift!" });
          queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey({ employeeId: empId }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatusQueryKey() });
        }
      });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card className="text-center shadow-lg border-primary/10">
        <CardHeader className="space-y-4 pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Time Clock</CardTitle>
          <CardDescription className="text-lg">Select your name and clock in or out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={loadingEmployees}>
            <SelectTrigger className="w-full h-14 text-lg">
              <SelectValue placeholder="Select your name..." />
            </SelectTrigger>
            <SelectContent>
              {employees?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()} className="text-lg py-3">
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            size="lg" 
            className={`w-full h-24 text-2xl font-bold transition-all shadow-md ${isClockedIn ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
            disabled={!selectedEmployee || clockInMutation.isPending || clockOutMutation.isPending}
            onClick={handleClockAction}
          >
            {isClockedIn ? "CLOCK OUT" : "CLOCK IN"}
          </Button>

          {selectedEmployee && (
            <div className="text-sm text-muted-foreground pt-4">
              {isClockedIn ? (
                <span>You clocked in at {new Date(activeEntry.clockIn).toLocaleTimeString()}</span>
              ) : (
                <span>You are currently clocked out</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
