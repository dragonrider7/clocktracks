import { useState } from "react";
import {
  useListEmployees,
  useClockIn,
  useClockOut,
  useGetDashboardStatus,
  getGetDashboardStatusQueryKey,
  getListTimeEntriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, Timer } from "lucide-react";
import { useMe } from "@/contexts/me-context";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { useRunningClock } from "@/hooks/use-running-clock";

function ClockedInListRow({ employeeId, employeeName, department, imageUrl, clockIn }: {
  employeeId: number;
  employeeName: string;
  department: string | null;
  imageUrl: string | null;
  clockIn: string;
}) {
  const elapsed = useRunningClock(clockIn);
  return (
    <div key={employeeId} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <EmployeeAvatar name={employeeName} imageUrl={imageUrl} size="sm" />
        <div>
          <div className="font-medium text-sm">{employeeName}</div>
          <div className="text-xs text-muted-foreground">{department ?? ""}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-muted-foreground">
          Since {new Date(clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-xs font-semibold text-green-700 flex items-center gap-0.5 justify-end">
          <Timer className="h-3 w-3" />
          {elapsed}
        </div>
      </div>
    </div>
  );
}

function ActiveClockStatus({ clockIn }: { clockIn: string }) {
  const elapsed = useRunningClock(clockIn);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="font-bold text-green-700">Clocked In</span>
      </div>
      <div className="text-sm text-green-600 mt-1">
        Since{" "}
        {new Date(clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-green-100 w-fit">
        <Timer className="h-3.5 w-3.5 text-green-700" />
        <span className="text-sm font-bold text-green-800">{elapsed}</span>
        <span className="text-xs text-green-600">this session</span>
      </div>
    </div>
  );
}

export default function ClockPage() {
  const { me, isAdmin } = useMe();
  const { data: employees } = useListEmployees();
  const { data: status, isLoading: statusLoading } = useGetDashboardStatus();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const effectiveEmployeeId = isAdmin ? selectedEmployeeId : me?.id ?? null;

  const isClockedIn = status?.clockedInEmployees?.some(
    (e) => e.employeeId === effectiveEmployeeId,
  );

  const activeEntry = status?.clockedInEmployees?.find(
    (e) => e.employeeId === effectiveEmployeeId,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey() });
  };

  const handleClockIn = () => {
    if (!effectiveEmployeeId) return;
    clockInMutation.mutate(
      { data: { employeeId: effectiveEmployeeId } },
      {
        onSuccess: () => {
          toast({ title: "Clocked in successfully" });
          invalidate();
        },
        onError: () => {
          toast({ title: "Already clocked in", variant: "destructive" });
        },
      },
    );
  };

  const handleClockOut = () => {
    if (!activeEntry) return;
    clockOutMutation.mutate(
      { id: activeEntry.timeEntryId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Clocked out successfully" });
          invalidate();
        },
      },
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            Clock In / Out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAdmin ? (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Select Employee
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {employees?.map((emp) => {
                  const active = status?.clockedInEmployees?.some((e) => e.employeeId === emp.id);
                  const selected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      data-testid={`button-employee-${emp.id}`}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                      className={`rounded-xl border px-3 py-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <EmployeeAvatar name={emp.name} imageUrl={emp.imageUrl} size="sm" />
                        <div className="font-medium text-sm truncate">{emp.name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground pl-10">
                        {emp.department ?? emp.role}
                      </div>
                      {active && (
                        <span className="mt-1.5 ml-10 inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                          Clocked in
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border p-4 bg-muted/30">
              <EmployeeAvatar name={me?.name ?? "?"} imageUrl={me?.imageUrl} size="md" />
              <div>
                <div className="font-semibold">{me?.name}</div>
                <div className="text-sm text-muted-foreground">{me?.department ?? me?.role}</div>
              </div>
            </div>
          )}

          {effectiveEmployeeId && (
            <div className="space-y-3">
              <div
                className={`rounded-xl border p-4 ${
                  isClockedIn
                    ? "bg-green-50 border-green-200"
                    : "bg-muted/30"
                }`}
              >
                <div className="text-sm text-muted-foreground mb-1">Current status</div>
                {statusLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : isClockedIn && activeEntry ? (
                  <ActiveClockStatus clockIn={activeEntry.clockIn} />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                    <span className="text-muted-foreground font-medium">Not clocked in</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  disabled={isClockedIn || clockInMutation.isPending || !effectiveEmployeeId}
                  onClick={handleClockIn}
                  data-testid="button-clock-in"
                  className="h-14 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <LogIn className="w-5 h-5" />
                  Clock In
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={!isClockedIn || clockOutMutation.isPending}
                  onClick={handleClockOut}
                  data-testid="button-clock-out"
                  className="h-14 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut className="w-5 h-5" />
                  Clock Out
                </Button>
              </div>
            </div>
          )}

          {isAdmin && !effectiveEmployeeId && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Select an employee above to clock them in or out.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Currently Clocked In
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (status?.clockedInEmployees?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No one is currently clocked in.
            </div>
          ) : (
            <div className="space-y-2">
              {status?.clockedInEmployees?.map((e) => (
                <ClockedInListRow
                  key={e.employeeId}
                  employeeId={e.employeeId}
                  employeeName={e.employeeName}
                  department={e.department ?? null}
                  imageUrl={e.imageUrl ?? null}
                  clockIn={e.clockIn}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
