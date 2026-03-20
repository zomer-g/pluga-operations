import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CREW_ROLES } from '@/lib/constants';
import { noonToday, noonTomorrow } from '@/lib/utils';
import type { Soldier, Tank, CrewRole } from '@/db/schema';

interface QuickAssignSheetProps {
  open: boolean;
  onClose: () => void;
  soldiers: Soldier[];
  tanks: Tank[];
  onAssign: (data: {
    soldierId: string;
    type: 'tank_role' | 'general_mission';
    tankId?: string;
    role?: CrewRole;
    missionName?: string;
    startDateTime: string;
    endDateTime: string;
  }) => Promise<void>;
  /** Pre-filled from reassign */
  prefill?: {
    soldierId?: string;
    tankId?: string;
    role?: string;
    startDateTime?: string;
    endDateTime?: string;
  };
}

export function QuickAssignSheet({ open, onClose, soldiers, tanks, onAssign, prefill }: QuickAssignSheetProps) {
  const [soldierId, setSoldierId] = useState(prefill?.soldierId ?? '');
  const [tankId, setTankId] = useState(prefill?.tankId ?? '');
  const [role, setRole] = useState(prefill?.role ?? '');
  const [startDT, setStartDT] = useState(prefill?.startDateTime ?? noonToday());
  const [endDT, setEndDT] = useState(prefill?.endDateTime ?? noonTomorrow());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!soldierId) return;
    setSaving(true);
    try {
      await onAssign({
        soldierId,
        type: tankId ? 'tank_role' : 'general_mission',
        tankId: tankId || undefined,
        role: (role as CrewRole) || undefined,
        startDateTime: startDT,
        endDateTime: endDT,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>שיבוץ מהיר</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">חייל</Label>
            <Select value={soldierId || '__none__'} onValueChange={(v) => setSoldierId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="text-base py-3">
                <SelectValue placeholder="בחר חייל..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">בחר חייל...</SelectItem>
                {soldiers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">רכב</Label>
            <Select value={tankId || '__none__'} onValueChange={(v) => setTankId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="text-base py-3">
                <SelectValue placeholder="בחר רכב (אופציונלי)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא רכב</SelectItem>
                {tanks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.designation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tankId && (
            <div>
              <Label className="text-sm">תפקיד</Label>
              <Select value={role || '__none__'} onValueChange={(v) => setRole(v === '__none__' ? '' : v)}>
                <SelectTrigger className="text-base py-3">
                  <SelectValue placeholder="בחר תפקיד..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">בחר תפקיד...</SelectItem>
                  {CREW_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">מ-</Label>
              <Input
                type="datetime-local"
                value={startDT}
                onChange={(e) => setStartDT(e.target.value)}
                className="text-base py-3"
              />
            </div>
            <div>
              <Label className="text-sm">עד</Label>
              <Input
                type="datetime-local"
                value={endDT}
                onChange={(e) => setEndDT(e.target.value)}
                className="text-base py-3"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !soldierId}
            className="w-full py-4 text-base touch-target"
          >
            {saving ? 'משבץ...' : 'שבץ'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
