import { useListEmployees, useCreateEmployee, useDeleteEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Employees() {
  const { data: employees, isLoading } = useListEmployees();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', department: '', role: 'employee' as const });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateEmployee();
  const deleteMutation = useDeleteEmployee();

  const handleAdd = () => {
    if (!newEmp.name) return;
    createMutation.mutate({ data: newEmp }, {
      onSuccess: () => {
        toast({ title: "Employee Added" });
        setIsAddOpen(false);
        setNewEmp({ name: '', department: '', role: 'employee' });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Employee Deleted" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Members</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="w-4 h-4 mr-2" /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Input value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value})} placeholder="Sales" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={newEmp.role} onValueChange={(v: 'employee'|'admin') => setNewEmp({...newEmp, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={!newEmp.name || createMutation.isPending}>
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
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
            ) : employees?.map(emp => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>{emp.department || '-'}</TableCell>
                <TableCell className="capitalize">{emp.role}</TableCell>
                <TableCell>{new Date(emp.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
