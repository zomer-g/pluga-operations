import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShampafTable } from '@/components/shampaf/ShampafTable';
import { GanttChart } from '@/components/gantt/GanttChart';
import type { GanttRow } from '@/components/gantt/GanttChart';
import { useShampafEntries, useAllShampafVacations } from '@/hooks/useShampaf';
import { useSoldiers } from '@/hooks/useSoldiers';
import { SHAMPAF_COLORS } from '@/lib/constants';

export function ShampafPage() {
  const entries = useShampafEntries();
  const vacations = useAllShampafVacations();
  const soldiers = useSoldiers();

  // Default date range: -7 days to +30 days
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 7);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 30);

  const defaultStartStr = defaultStart.toISOString().split('T')[0]!;
  const defaultEndStr = defaultEnd.toISOString().split('T')[0]!;

  // Build Gantt rows: group by soldier
  const ganttRows = useMemo<GanttRow[]>(() => {
    if (!entries || !vacations || !soldiers) return [];

    // Get unique soldier IDs that have shampaf entries
    const soldierIds = [...new Set(entries.map((e) => e.soldierId))];

    return soldierIds
      .map((soldierId) => {
        const soldier = soldiers.find((s) => s.id === soldierId);
        if (!soldier) return null;

        const soldierEntries = entries.filter((e) => e.soldierId === soldierId);
        const soldierVacations = vacations.filter((v) => v.soldierId === soldierId);

        const bars = [
          // Green bars for mobilization periods
          ...soldierEntries.map((entry) => ({
            id: entry.id,
            startDateTime: entry.startDateTime,
            endDateTime: entry.endDateTime,
            color: SHAMPAF_COLORS.mobilized,
            tooltip: `שמ"פ: ${new Date(entry.startDateTime).toLocaleDateString('he-IL')} - ${new Date(entry.endDateTime).toLocaleDateString('he-IL')}`,
          })),
          // Amber bars for vacation periods (overlay)
          ...soldierVacations.map((vac) => ({
            id: vac.id,
            startDateTime: vac.startDateTime,
            endDateTime: vac.endDateTime,
            color: SHAMPAF_COLORS.vacation,
            tooltip: `חופשה: ${vac.reason || ''} ${new Date(vac.startDateTime).toLocaleDateString('he-IL')} - ${new Date(vac.endDateTime).toLocaleDateString('he-IL')}`,
          })),
        ];

        return {
          id: soldierId,
          label: `${soldier.firstName} ${soldier.lastName[0]}'`,
          bars,
        };
      })
      .filter(Boolean) as GanttRow[];
  }, [entries, vacations, soldiers]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">שמ"פ - שירות מילואים פעיל</h2>

      <Tabs defaultValue="table" dir="rtl">
        <TabsList>
          <TabsTrigger value="table">טבלה</TabsTrigger>
          <TabsTrigger value="gantt">גאנט</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {entries && vacations && soldiers ? (
            <ShampafTable
              entries={entries}
              vacations={vacations}
              soldiers={soldiers}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>טוען נתונים...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gantt">
          {/* Legend */}
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

          <GanttChart
            rows={ganttRows}
            startDate={defaultStartStr}
            endDate={defaultEndStr}
            showTodayMarker
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
