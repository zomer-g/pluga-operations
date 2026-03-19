import { useState, useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSoldiers } from '@/hooks/useSoldiers';
import { useAllStatusEntries } from '@/hooks/useStatusHistory';
import { getStatusInfo, getRankLabel } from '@/lib/constants';
import type { SoldierStatus, StatusEntry } from '@/db/schema';

export function StatusBoardPage() {
  const soldiers = useSoldiers();
  const allEntries = useAllStatusEntries();

  // Date range for the timeline - default: last 30 days to 30 days ahead
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 30);

  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]!);
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().split('T')[0]!);

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const getEntriesForSoldier = (soldierId: string): StatusEntry[] => {
    return allEntries?.filter((e) => e.soldierId === soldierId) ?? [];
  };

  const statusColorMap: Record<string, string> = {
    active: 'bg-status-active',
    reserve_ready: 'bg-status-reserve',
    training: 'bg-status-training',
    leave: 'bg-status-leave',
    medical_leave: 'bg-status-medical',
    released: 'bg-status-released',
    absent: 'bg-status-absent',
    other: 'bg-gray-500',
  };

  const getBarStyle = (entry: StatusEntry) => {
    const entryStart = new Date(entry.startDate);
    const entryEnd = entry.endDate ? new Date(entry.endDate) : new Date();

    const clampedStart = new Date(Math.max(entryStart.getTime(), rangeStart.getTime()));
    const clampedEnd = new Date(Math.min(entryEnd.getTime(), rangeEnd.getTime()));

    if (clampedStart >= rangeEnd || clampedEnd <= rangeStart) return null;

    const leftPct = ((clampedStart.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100;
    const widthPct = ((clampedEnd.getTime() - clampedStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100;

    return {
      right: `${leftPct}%`,
      width: `${Math.max(widthPct, 1)}%`,
    };
  };

  // Month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; position: number }[] = [];
    const d = new Date(rangeStart);
    d.setDate(1);
    if (d < rangeStart) d.setMonth(d.getMonth() + 1);

    while (d <= rangeEnd) {
      const pct = ((d.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100;
      markers.push({
        label: d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
        position: pct,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [startDate, endDate]);

  // Today marker
  const todayPct = ((today.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">לוח סטטוסים</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">מ:</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">עד:</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusColorMap).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded-full ${color}`} />
            <span className="text-xs">{getStatusInfo(status as SoldierStatus).label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          {soldiers && soldiers.length > 0 ? (
            <div className="min-w-[600px]">
              {/* Month headers */}
              <div className="relative h-6 border-b mb-2">
                {monthMarkers.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-xs text-muted-foreground"
                    style={{ right: `${m.position}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {soldiers.map((soldier) => {
                  const entries = getEntriesForSoldier(soldier.id);
                  return (
                    <div key={soldier.id} className="flex items-center gap-3 h-8">
                      <div className="w-40 shrink-0 text-sm truncate">
                        {soldier.rank ? getRankLabel(soldier.rank) : ''} {soldier.firstName} {soldier.lastName[0]}'
                      </div>
                      <div className="flex-1 relative h-6 bg-card rounded border">
                        {/* Today line */}
                        {todayPct >= 0 && todayPct <= 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                            style={{ right: `${todayPct}%` }}
                          />
                        )}
                        {entries.map((entry) => {
                          const style = getBarStyle(entry);
                          if (!style) return null;
                          return (
                            <div
                              key={entry.id}
                              className={`absolute top-0.5 bottom-0.5 rounded-sm ${statusColorMap[entry.status] ?? 'bg-gray-500'} opacity-80`}
                              style={style}
                              title={`${getStatusInfo(entry.status).label}${entry.notes ? `: ${entry.notes}` : ''}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>אין חיילים להצגה</p>
              <p className="text-xs mt-1">הוסף חיילים ועדכן את הסטטוס שלהם</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
