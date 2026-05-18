import { useListEmployees, useCreateEmployee, useDeleteEmployee, useUpdateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserPlus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Redirect } from "wouter";
import { useMe } from "@/App";
import { EmployeeAvatar } from "@/components/employee-avatar";

const DEFAULT_ALLOTMENT = 80;

export default function Employees() {
  const { isAdmin, isLoading: meLoading } = useMe();
  const { data: employees, isLoading } = useListEmployees();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<{
    id: number;
    name: string;
    department: string;
    role: "employee" | "admin";
    email: string;
    timeOffAllotmentHours: number;
    hiredDate: string;
    birthday: string;
  } | null>(null);
  const [newEmp, setNewEmp] = useState({
    name: "",
    department: "",
    role: "employee" as "employee" | "admin",
    email: "",
    timeOffAllotmentHours: DEFAULT_ALLOTMENT,
    hiredDate: "",
    birthday: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateEmployee();
  const deleteMutation = useDeleteEmployee();
  const updateMutation = useUpdateEmployee();

  if (!meLoading && !isAdmin) return <Redirect to="/dashboard" />;

  const handleAdd = () => {
    if (!newEmp.name) return;
    createMutation.mutate(
      {
        data: {
          name: newEmp.name,
          role: newEmp.role,
          department: newEmp.department || undefined,
          email: newEmp.email || undefined,
          timeOffAllotmentHours: newEmp.timeOffAllotmentHours,
          hiredDate: newEmp.hiredDate || undefined,
          birthday: newEmp.birthday || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Employee added" });
          setIsAddOpen(false);
          setNewEmp({ name: "", department: "", role: "employee", email: "", timeOffAllotmentHours: DEFAULT_ALLOTMENT, hiredDate: "", birthday: "" });
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to remove this employee?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Employee removed" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
    });
  };

  const handleUpdate = () => {
    if (!editEmp) return;
    updateMutation.mutate(
      {
        id: editEmp.id,
        data: {
          name: editEmp.name,
          role: editEmp.role,
          department: editEmp.department || undefined,
          email: editEmp.email || undefined,
          timeOffAllotmentHours: editEmp.timeOffAllotmentHours,
          hiredDate: editEmp.hiredDate || undefined,
          birthday: editEmp.birthday || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Employee updated" });
          setEditEmp(null);
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Members</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-employee">
              <UserPlus className="w-4 h-4 mr-2" />Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input data-testid="input-name" value={newEmp.name} onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input data-testid="input-email" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} placeholder="jane@company.com" type="email" />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Input data-testid="input-department" value={newEmp.department} onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })} placeholder="Sales" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={newEmp.role} onValueChange={(v: "employee" | "admin") => setNewEmp({ ...newEmp, role: v })}>
                  <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Time Off Allotment (hours/year)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={8}
                    value={newEmp.timeOffAllotmentHours}
                    onChange={(e) => setNewEmp({ ...newEmp, timeOffAllotmentHours: parseInt(e.target.value) || 0 })}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">hours ({Math.round(newEmp.timeOffAllotmentHours / 8)} days)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Default is {DEFAULT_ALLOTMENT}h ({DEFAULT_ALLOTMENT / 8} days). Each day of time off = 8 hours.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Hired Date</label>
                <Input
                  type="date"
                  value={newEmp.hiredDate}
                  onChange={(e) => setNewEmp({ ...newEmp, hiredDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Used to celebrate work anniversaries on the dashboard.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Birthday</label>
                <Input
                  type="date"
                  value={newEmp.birthday}
                  onChange={(e) => setNewEmp({ ...newEmp, birthday: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Used to display upcoming birthdays on the dashboard.</p>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={!newEmp.name || createMutation.isPending} data-testid="button-create-employee">
                Create Employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Time Off Allotment</TableHead>
              <TableHead>Hired Date</TableHead>
              <TableHead>Linked Account</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
            ) : (
              employees?.map((emp) => {
                const allotment = emp.timeOffAllotmentHours ?? DEFAULT_ALLOTMENT;
                return (
                  <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar name={emp.name} size="sm" />
                        <span className="font-medium">{emp.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email || "—"}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {emp.role === "admin" ? "Admin" : "Employee"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{allotment}h</span>
                      <span className="text-xs text-muted-foreground ml-1.5">({Math.round(allotment / 8)} days)</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(emp as typeof emp & { hiredDate?: string | null }).hiredDate
                        ? new Date((emp as typeof emp & { hiredDate?: string | null }).hiredDate!.replace(/-/g, "/")).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(emp as typeof emp & { clerkUserId?: string | null }).clerkUserId ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {(emp as typeof emp & { clerkUserId?: string | null }).clerkUserId ? "Connected" : "Not signed in"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" data-testid={`button-edit-${emp.id}`}
                          onClick={() => setEditEmp({
                            id: emp.id,
                            name: emp.name,
                            department: emp.department ?? "",
                            role: (emp.role as "employee" | "admin") ?? "employee",
                            email: emp.email ?? "",
                            timeOffAllotmentHours: allotment,
                            hiredDate: (emp as typeof emp & { hiredDate?: string | null }).hiredDate ?? "",
                            birthday: (emp as typeof emp & { birthday?: string | null }).birthday ?? "",
                          })}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-${emp.id}`} onClick={() => handleDelete(emp.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editEmp} onOpenChange={(open) => !open && setEditEmp(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          {editEmp && (
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input value={editEmp.name} onChange={(e) => setEditEmp({ ...editEmp, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={editEmp.email} onChange={(e) => setEditEmp({ ...editEmp, email: e.target.value })} type="email" />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Input value={editEmp.department} onChange={(e) => setEditEmp({ ...editEmp, department: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={editEmp.role} onValueChange={(v: "employee" | "admin") => setEditEmp({ ...editEmp, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Time Off Allotment (hours/year)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={8}
                    value={editEmp.timeOffAllotmentHours}
                    onChange={(e) => setEditEmp({ ...editEmp, timeOffAllotmentHours: parseInt(e.target.value) || 0 })}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">hours ({Math.round(editEmp.timeOffAllotmentHours / 8)} days)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Each day of time off = 8 hours.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Hired Date</label>
                <Input
                  type="date"
                  value={editEmp.hiredDate}
                  onChange={(e) => setEditEmp({ ...editEmp, hiredDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Used to celebrate work anniversaries on the dashboard.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Birthday</label>
                <Input
                  type="date"
                  value={editEmp.birthday}
                  onChange={(e) => setEditEmp({ ...editEmp, birthday: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Used to display upcoming birthdays on the dashboard.</p>
              </div>
              <Button className="w-full" onClick={handleUpdate} disabled={!editEmp.name || updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
