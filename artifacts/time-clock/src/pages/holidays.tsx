import { useState } from "react";
import { Gift, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import {
  useListHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  type Holiday,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type HolidayForm = { name: string; date: string; hoursPerDay: number };

const EMPTY_FORM: HolidayForm = { name: "", date: "", hoursPerDay: 8 };

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

function groupByYear(holidays: Holiday[]): Map<number, Holiday[]> {
  const map = new Map<number, Holiday[]>();
  for (const h of holidays) {
    const year = parseInt(h.date.split("-")[0]);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(h);
  }
  return map;
}

export default function Holidays() {
  const { toast } = useToast();
  const { data: holidays = [], refetch } = useListHolidays();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditTarget(h);
    setForm({ name: h.name, date: h.date, hoursPerDay: h.hoursPerDay });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.date) {
      toast({ title: "Name and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await updateHoliday.mutateAsync({ id: editTarget.id, data: form });
        toast({ title: "Holiday updated" });
      } else {
        await createHoliday.mutateAsync({ data: form });
        toast({ title: "Holiday added" });
      }
      await refetch();
      setDialogOpen(false);
    } catch {
      toast({ title: "Failed to save holiday", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteHoliday.mutateAsync({ id: deleteId });
      toast({ title: "Holiday deleted" });
      await refetch();
    } catch {
      toast({ title: "Failed to delete holiday", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const byYear = groupByYear(sorted);
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6 text-amber-500" />
            Holidays
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Company-wide holidays are counted as paid time in timesheets and do not reduce PTO balances.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Holiday
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-30" />
            <p className="font-medium">No holidays added yet</p>
            <p className="text-sm">Add company holidays to have them automatically counted in timesheets.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2 gap-2">
              <Plus className="h-4 w-4" />
              Add First Holiday
            </Button>
          </CardContent>
        </Card>
      ) : (
        years.map((year) => (
          <Card key={year}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-muted-foreground">{year}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium">Holiday</th>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-center px-4 py-2 font-medium">Hours</th>
                    <th className="px-4 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {byYear.get(year)!.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{h.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(h.date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 min-w-[2.5rem]">
                          {h.hoursPerDay}h
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(h)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(h.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g. Christmas Day"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hours Per Day</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.hoursPerDay}
                onChange={(e) => setForm((f) => ({ ...f, hoursPerDay: parseInt(e.target.value) || 8 }))}
              />
              <p className="text-xs text-muted-foreground">
                Default is 8 hours. Use 4 for a half-day holiday.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the holiday. It will no longer appear in timesheets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
