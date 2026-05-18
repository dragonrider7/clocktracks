import { useState } from "react";
import { Gift, Plus, Pencil, Trash2, CalendarDays, RefreshCw, Repeat2, CalendarCheck } from "lucide-react";
import {
  useListHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  useSeedHolidays,
  getListHolidaysQueryKey,
  type Holiday,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const NTH_OPTIONS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: -1, label: "Last" },
];

type RecurrenceType = "none" | "fixed" | "nth_weekday";

type HolidayForm = {
  name: string;
  hoursPerDay: number;
  recurrenceType: RecurrenceType;
  date: string;
  recurrenceMonth: number;
  recurrenceDayOfMonth: number;
  recurrenceWeekday: number;
  recurrenceNth: number;
};

const EMPTY_FORM: HolidayForm = {
  name: "",
  hoursPerDay: 8,
  recurrenceType: "none",
  date: "",
  recurrenceMonth: 1,
  recurrenceDayOfMonth: 1,
  recurrenceWeekday: 1,
  recurrenceNth: 1,
};

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function holidayToForm(h: Holiday): HolidayForm {
  return {
    name: h.name,
    hoursPerDay: h.hoursPerDay,
    recurrenceType: (h.recurrenceType as RecurrenceType) || "none",
    date: h.date ?? "",
    recurrenceMonth: h.recurrenceMonth ?? 1,
    recurrenceDayOfMonth: h.recurrenceDayOfMonth ?? 1,
    recurrenceWeekday: h.recurrenceWeekday ?? 1,
    recurrenceNth: h.recurrenceNth ?? 1,
  };
}

function RecurrenceTypePicker({
  value,
  onChange,
}: {
  value: RecurrenceType;
  onChange: (v: RecurrenceType) => void;
}) {
  const opts: { value: RecurrenceType; label: string }[] = [
    { value: "none", label: "One-time" },
    { value: "fixed", label: "Fixed date" },
    { value: "nth_weekday", label: "Floating weekday" },
  ];
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
            value === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Holidays() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: holidays = [] } = useListHolidays();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const seedHolidays = useSeedHolidays();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const recurring = holidays.filter((h) => h.recurrenceType !== "none")
    .sort((a, b) => (a.recurrenceMonth ?? 0) - (b.recurrenceMonth ?? 0) || a.name.localeCompare(b.name));

  const oneTime = holidays.filter((h) => h.recurrenceType === "none")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const oneTimeByYear = new Map<number, Holiday[]>();
  for (const h of oneTime) {
    const yr = h.date ? parseInt(h.date.split("-")[0]) : 0;
    if (!oneTimeByYear.has(yr)) oneTimeByYear.set(yr, []);
    oneTimeByYear.get(yr)!.push(h);
  }
  const oneTimeYears = Array.from(oneTimeByYear.keys()).sort((a, b) => b - a);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditTarget(h);
    setForm(holidayToForm(h));
    setDialogOpen(true);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: getListHolidaysQueryKey() });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (form.recurrenceType === "none" && !form.date) {
      toast({ title: "Date is required for one-time holidays", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await updateHoliday.mutateAsync({
          id: editTarget.id,
          data: {
            name: form.name.trim(),
            hoursPerDay: form.hoursPerDay,
            recurrenceType: form.recurrenceType,
            date: form.recurrenceType === "none" ? form.date : null,
            recurrenceMonth: form.recurrenceType !== "none" ? form.recurrenceMonth : null,
            recurrenceDayOfMonth: form.recurrenceType === "fixed" ? form.recurrenceDayOfMonth : null,
            recurrenceWeekday: form.recurrenceType === "nth_weekday" ? form.recurrenceWeekday : null,
            recurrenceNth: form.recurrenceType === "nth_weekday" ? form.recurrenceNth : null,
          },
        });
        toast({ title: "Holiday updated" });
      } else {
        await createHoliday.mutateAsync({
          data: {
            name: form.name.trim(),
            hoursPerDay: form.hoursPerDay,
            recurrenceType: form.recurrenceType,
            ...(form.recurrenceType === "none" ? { date: form.date } : {}),
            ...(form.recurrenceType !== "none" ? { recurrenceMonth: form.recurrenceMonth } : {}),
            ...(form.recurrenceType === "fixed" ? { recurrenceDayOfMonth: form.recurrenceDayOfMonth } : {}),
            ...(form.recurrenceType === "nth_weekday" ? { recurrenceWeekday: form.recurrenceWeekday, recurrenceNth: form.recurrenceNth } : {}),
          },
        });
        toast({ title: "Holiday added" });
      }
      await invalidate();
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
      await invalidate();
    } catch {
      toast({ title: "Failed to delete holiday", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSeed = async () => {
    try {
      const result = await seedHolidays.mutateAsync();
      await invalidate();
      if (result.created === 0) {
        toast({ title: "All US holidays already added" });
      } else {
        toast({ title: `Added ${result.created} US federal holiday${result.created !== 1 ? "s" : ""}` });
      }
    } catch {
      toast({ title: "Failed to seed holidays", variant: "destructive" });
    }
  };

  const HolidayActions = ({ h }: { h: Holiday }) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => setDeleteId(h.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const Hoursbadge = ({ h }: { h: Holiday }) => (
    <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 min-w-[2.5rem]">
      {h.hoursPerDay}h
    </span>
  );

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6 text-amber-500" />
            Holidays
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Company-wide holidays appear in timesheets and do not reduce PTO balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSeed}
            disabled={seedHolidays.isPending}
          >
            {seedHolidays.isPending
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Seed US Holidays
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {holidays.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-30" />
            <p className="font-medium">No holidays added yet</p>
            <p className="text-sm text-center max-w-sm">
              Add company holidays to have them automatically counted in timesheets, or seed all US federal holidays at once.
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={handleSeed} disabled={seedHolidays.isPending} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Seed US Holidays
              </Button>
              <Button variant="outline" onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Custom Holiday
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring holidays */}
      {recurring.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-base">Recurring Holidays</CardTitle>
            </div>
            <CardDescription>Automatically repeat every year based on their rule</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium">Holiday</th>
                  <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Rule</th>
                  <th className="text-left px-4 py-2 font-medium">{currentYear} Date</th>
                  <th className="text-center px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {recurring.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{h.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs font-normal">
                        {h.recurrenceLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {h.resolvedCurrentYear ? fmtDate(h.resolvedCurrentYear) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center"><Hoursbadge h={h} /></td>
                    <td className="px-4 py-3"><HolidayActions h={h} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* One-time holidays by year */}
      {oneTime.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-base">One-Time Holidays</CardTitle>
            </div>
            <CardDescription>Fixed to a specific calendar date</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium">Holiday</th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-center px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {oneTimeYears.flatMap((yr) => [
                  <tr key={`yr-${yr}`} className="border-b bg-muted/20">
                    <td
                      colSpan={4}
                      className="px-4 pt-2.5 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {yr}
                    </td>
                  </tr>,
                  ...oneTimeByYear.get(yr)!.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{h.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.date ? fmtDate(h.date) : "—"}</td>
                      <td className="px-4 py-3 text-center"><Hoursbadge h={h} /></td>
                      <td className="px-4 py-3"><HolidayActions h={h} /></td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Recurrence type */}
            <div className="space-y-1.5">
              <Label>Repeats</Label>
              <RecurrenceTypePicker
                value={form.recurrenceType}
                onChange={(v) => setForm((f) => ({ ...f, recurrenceType: v }))}
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g. Christmas Day"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Recurrence-specific fields */}
            {form.recurrenceType === "none" && (
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            )}

            {form.recurrenceType === "fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <Select
                    value={String(form.recurrenceMonth)}
                    onValueChange={(v) => setForm((f) => ({ ...f, recurrenceMonth: parseInt(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.slice(1).map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.recurrenceDayOfMonth}
                    onChange={(e) => setForm((f) => ({ ...f, recurrenceDayOfMonth: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            )}

            {form.recurrenceType === "nth_weekday" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Occurrence</Label>
                    <Select
                      value={String(form.recurrenceNth)}
                      onValueChange={(v) => setForm((f) => ({ ...f, recurrenceNth: parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NTH_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Weekday</Label>
                    <Select
                      value={String(form.recurrenceWeekday)}
                      onValueChange={(v) => setForm((f) => ({ ...f, recurrenceWeekday: parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((name, i) => (
                          <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <Select
                    value={String(form.recurrenceMonth)}
                    onValueChange={(v) => setForm((f) => ({ ...f, recurrenceMonth: parseInt(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.slice(1).map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Example: "Last Monday of May" = Memorial Day
                </p>
              </div>
            )}

            {/* Hours */}
            <div className="space-y-1.5">
              <Label>Hours Per Day</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={form.hoursPerDay}
                  onChange={(e) => setForm((f) => ({ ...f, hoursPerDay: parseInt(e.target.value) || 8 }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours (use 4 for a half-day)</span>
              </div>
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

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the holiday. It will no longer appear in timesheets.
              {holidays.find((h) => h.id === deleteId)?.recurrenceType !== "none" && (
                <span className="block mt-1 font-medium">This is a recurring holiday — all future years will be affected.</span>
              )}
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
