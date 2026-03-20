import { useState, useMemo } from 'react';
import { CalendarClock, Plus, Settings2, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ShampafTable } from '@/components/shampaf/ShampafTable';
import { GanttChart } from '@/components/gantt/GanttChart';
import type { GanttRow } from '@/components/gantt/GanttChart';
import { useShampafEntries, useAllShampafVacations } from '@/hooks/useShampaf';
import { useActivations, addActivation, deleteActivation } from '@/hooks/useActivation';
import { useSoldiers } from '@/hooks/useSoldiers';
import { useAppStore } from '@/stores/useAppStore';
import { SHAMPAF_COLORS } from '@/lib/constants';
import { formatDate, dateRangesOverlap, todayString } from '@/lib/utils';

export function ShampafPage() {
  const allEntries = useShampafEntries();
  const vacations = useAllShampafVacations();
  const soldiers = useSoldiers();
  const activations = useActivations();

  // Global activation from store
  const selectedActivationId = useAppStore(s => s.selectedActivationId);
  const activeActivation = activations?.find(a => a.id === selectedActivationId) ?? null;

  // Activation dialog
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [actName, setActName] = useState('');
  const [actStart, setActStart] = useState(todayString());
  const [actEnd, setActEnd] = useState('');

  // Filter entries by activation date range
  const entries = useMemo(() => {
    if (!allEntries) return [];
    if (!activeActivation) return allEntries;
    return allEntries.filter(e =>
      dateRangesOverlap(
        e.startDateTime.split('T')[0]!,
        e.endDateTime.split('T')[0]!,
        activeActivation.startDate,
        activeActivation.endDate
      )
    );
  }, [allEntries, activeActivation]);

  // Gantt date range from activation
  const ganttStart = activeActivation?.startDate ?? todayString();
  const ganttEnd = activeActivation?.endDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0]!;
  })();

  // Build Gantt rows
  const ganttRows = useMemo<GanttRow[]>(() => {
    if (!entries || !vacations || !soldiers) return [];

    const soldierIds = [...new Set(entries.map((e) => e.soldierId))];

    return soldierIds
      .map((soldierId) => {
        const soldier = soldiers.find((s) => s.id === soldierId);
        if (!soldier) return null;

        const soldierEntries = entries.filter((e) => e.soldierId === soldierId);
        const soldierVacations = vacations.filter((v) => v.soldierId === soldierId);

        const bars = [
          ...soldierEntries.map((entry) => ({
            id: entry.id,
            startDateTime: entry.startDateTime,
            endDateTime: entry.endDateTime,
            color: SHAMPAF_COLORS.mobilized,
            tooltip: `שמ"פ: ${formatDate(entry.startDateTime.split('T')[0]!)} - ${formatDate(entry.endDateTime.split('T')[0]!)}`,
          })),
          ...soldierVacations.map((vac) => ({
            id: vac.id,
            startDateTime: vac.startDateTime,
            endDateTime: vac.endDateTime,
            color: SHAMPAF_COLORS.vacation,
            tooltip: `חופשה: ${vac.reason || ''} ${formatDate(vac.startDateTime.split('T')[0]!)} - ${formatDate(vac.endDateTime.split('T')[0]!)}`,
          })),
        ];

        return {
          id: soldierId,
          label: `${soldier.firstName} ${soldier.lastName}`,
          bars,
        };
      })
      .filter(Boolean) as GanttRow[];
  }, [entries, vacations, soldiers]);

  const handleAddActivation = async () => {
    if (!actName || !actStart || !actEnd) return;
    await addActivation({ name: actName, startDate: actStart, endDate: actEnd });
    setShowActivationDialog(false);
    setActName('');
    setActStart(todayString());
    setActEnd('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">שמ"פ - שירות מילואים פעיל</h2>
        <Button variant="outline" size="sm" onClick={() => setShowActivationDialog(true)}>
          <Settings2 className="h-4 w-4 me-1" />
          ניהול הפעלות
        </Button>
      </div>

      {/* No activation message */}
      {activations && activations.length === 0 && (
        <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
          <p className="text-sm">לא הוגדרה הפעלה. לחץ "ניהול הפעלות" כדי ליצור תקופת הפעלה חדשה.</p>
        </div>
      )}

      <Tabs defaultValue="table" dir="rtl">
        <TabsList>
          <TabsTrigger value="table">טבלה</TabsTrigger>
          <TabsTrigger value="gantt">גאנט</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {entries && vacations && soldiers ? (
            <ShampafTable entries={entries} vacations={vacations ?? []} soldiers={soldiers} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>טוען נתונים...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gantt">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${SHAMPAF_COLORS.mobilized}`} />
              <span className="text-xs">שמ"פ פעיל</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${SHAMPAF_COLORS.vacation}`} />
              <span className="text-xs">חופשה</span>
            </div>
          </div>
          <GanttChart rows={ganttRows} startDate={ganttStart} endDate={ganttEnd} showTodayMarker />
        </TabsContent>
      </Tabs>

      {/* Activation management dialog */}
      <Dialog open={showActivationDialog} onOpenChange={setShowActivationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ניהול הפעלות</DialogTitle>
            <DialogDescription>הפעלה מגדירה את תקופת הפעילות. הנתונים יוצגו לפי תקופה זו.</DialogDescription>
          </DialogHeader>

          {/* Existing activations */}
          {activations && activations.length > 0 && (
            <div className="space-y-2 mb-4">
              <Label className="text-xs text-muted-foreground">הפעלות קיימות</Label>
              {activations.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <span>{act.name} — {formatDate(act.startDate)} עד {formatDate(act.endDate)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteActivation(act.id)} aria-label="מחק הפעלה">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">הפעלה חדשה</Label>
            <div className="space-y-2">
              <Input value={actName} onChange={(e) => setActName(e.target.value)} placeholder='שם, למשל: "מבצע מגן"' />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">התחלה</Label>
                <Input type="date" value={actStart} onChange={(e) => setActStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">סיום</Label>
                <Input type="date" value={actEnd} onChange={(e) => setActEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivationDialog(false)}>סגור</Button>
            <Button onClick={handleAddActivation} disabled={!actName || !actStart || !actEnd}>
              <Plus className="h-4 w-4 me-1" />
              צור הפעלה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
