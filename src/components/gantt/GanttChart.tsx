import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GanttBar {
  id: string;
  startDateTime: string;
  endDateTime: string;
  color: string;
  tooltip: string;
  isWarning?: boolean;
}

export interface GanttRow {
  id: string;
  label: string;
  sublabel?: string;
  bars: GanttBar[];
  isGroupHeader?: boolean;
}

interface GanttChartProps {
  rows: GanttRow[];
  startDate: string;
  endDate: string;
  showTodayMarker?: boolean;
  onDateRangeChange?: (start: string, end: string) => void;
}

export function GanttChart({
  rows,
  startDate,
  endDate,
  showTodayMarker = true,
  onDateRangeChange,
}: GanttChartProps) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  const rangeStartMs = new Date(localStart).getTime();
  const rangeEndMs = new Date(localEnd).getTime();
  const totalRange = rangeEndMs - rangeStartMs;

  const handleStartChange = (val: string) => {
    setLocalStart(val);
    onDateRangeChange?.(val, localEnd);
  };

  const handleEndChange = (val: string) => {
    setLocalEnd(val);
    onDateRangeChange?.(localStart, val);
  };

  const getBarStyle = (bar: GanttBar) => {
    const barStart = new Date(bar.startDateTime).getTime();
    const barEnd = new Date(bar.endDateTime).getTime();

    const clampedStart = Math.max(barStart, rangeStartMs);
    const clampedEnd = Math.min(barEnd, rangeEndMs);

    if (clampedStart >= rangeEndMs || clampedEnd <= rangeStartMs) return null;

    const rightPct = ((clampedStart - rangeStartMs) / totalRange) * 100;
    const widthPct = ((clampedEnd - clampedStart) / totalRange) * 100;

    return {
      right: `${rightPct}%`,
      width: `${Math.max(widthPct, 0.5)}%`,
    };
  };

  // Month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; position: number }[] = [];
    const rangeStart = new Date(localStart);
    const rangeEnd = new Date(localEnd);
    const d = new Date(rangeStart);
    d.setDate(1);
    if (d < rangeStart) d.setMonth(d.getMonth() + 1);

    while (d <= rangeEnd) {
      const pct = ((d.getTime() - rangeStartMs) / totalRange) * 100;
      markers.push({
        label: d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
        position: pct,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [localStart, localEnd, rangeStartMs, totalRange]);

  // Today marker
  const now = new Date();
  const todayPct = ((now.getTime() - rangeStartMs) / totalRange) * 100;
  const showToday = showTodayMarker && todayPct >= 0 && todayPct <= 100;

  return (
    <div className="space-y-3">
      {/* Date range picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs">מ:</Label>
          <Input
            type="date"
            value={localStart}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-36 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">עד:</Label>
          <Input
            type="date"
            value={localEnd}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-36 h-9 text-sm"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          {rows.length > 0 ? (
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
                {rows.map((row) => {
                  // Group header row
                  if (row.isGroupHeader) {
                    return (
                      <div key={row.id} className="flex items-center gap-3 min-h-[28px] mt-3 first:mt-0">
                        <div className="w-full text-xs font-bold text-muted-foreground border-b pb-1">
                          {row.label}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={row.id} className="flex items-center gap-3 min-h-[32px]">
                      {/* Label on right side (RTL) */}
                      <div className="w-40 shrink-0 text-sm truncate">
                        <div className="font-medium truncate">{row.label}</div>
                        {row.sublabel && (
                          <div className="text-xs text-muted-foreground truncate">
                            {row.sublabel}
                          </div>
                        )}
                      </div>

                      {/* Timeline area */}
                      <div className="flex-1 relative h-6 bg-card rounded border">
                        {/* Today line */}
                        {showToday && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                            style={{ right: `${todayPct}%` }}
                          />
                        )}

                        {/* Bars */}
                        {row.bars.map((bar) => {
                          const style = getBarStyle(bar);
                          if (!style) return null;
                          return (
                            <div
                              key={bar.id}
                              className={cn(
                                'absolute top-0.5 bottom-0.5 rounded-sm opacity-80',
                                bar.color,
                                bar.isWarning && 'border-2 border-dashed border-red-500'
                              )}
                              style={style}
                              title={bar.tooltip}
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
            <div className="text-center py-8 text-muted-foreground text-sm">
              אין נתונים להצגה
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
