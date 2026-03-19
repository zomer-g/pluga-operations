import { useState } from 'react';
import { Plus, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStatusHistory, addStatusEntry } from '@/hooks/useStatusHistory';
import { SOLDIER_STATUSES, getStatusInfo, getStatusBadgeVariant } from '@/lib/constants';
import { formatDate, todayString } from '@/lib/utils';

interface Props {
  soldierId: string;
}

export function SoldierStatusTab({ soldierId }: Props) {
  const history = useStatusHistory(soldierId);
  const [showAdd, setShowAdd] = useState(false);

  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    await addStatusEntry(soldierId, {
      status,
      startDate,
      endDate: endDate || undefined,
      orderNumber: orderNumber || undefined,
      notes: notes || undefined,
    });
    setShowAdd(false);
    setStatus('');
    setStartDate(todayString());
    setEndDate('');
    setOrderNumber('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">היסטוריית סטטוסים</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 me-1" />
            שינוי סטטוס
          </Button>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-4">
                {history.map((entry) => {
                  const info = getStatusInfo(entry.status);
                  const isCurrent = !entry.endDate;
                  return (
                    <div key={entry.id} className="flex gap-4 relative">
                      <div className="relative z-10 mt-1">
                        <Circle
                          className={`h-6 w-6 ${isCurrent ? 'fill-primary text-primary' : 'fill-muted text-muted'}`}
                        />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getStatusBadgeVariant(entry.status) as any}>
                            {info.label}
                          </Badge>
                          {isCurrent && (
                            <Badge variant="outline" className="text-xs">נוכחי</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.startDate)}
                          {entry.endDate ? ` - ${formatDate(entry.endDate)}` : ' - נוכחי'}
                        </p>
                        {entry.orderNumber && (
                          <p className="text-xs text-muted-foreground">צו: {entry.orderNumber}</p>
                        )}
                        {entry.notes && (
                          <p className="text-sm mt-1">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">אין היסטוריית סטטוסים</p>
          )}
        </CardContent>
      </Card>

      {/* Add status dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שינוי סטטוס</DialogTitle>
            <DialogDescription>סטטוס קודם ייסגר אוטומטית</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                <SelectContent>
                  {SOLDIER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>תאריך התחלה</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>תאריך סיום (אופציונלי)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>מספר צו</Label>
              <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ביטול</Button>
            <Button onClick={handleAdd} disabled={!status || !startDate}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
