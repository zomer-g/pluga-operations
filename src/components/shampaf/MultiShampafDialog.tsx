import { useState, useMemo } from 'react';
import { Users, Search, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { todayString } from '@/lib/utils';
import {
  checkShampafBatchConflicts,
  addShampafEntriesBatch,
} from '@/hooks/useShampaf';
import type { ShampafConflict } from '@/hooks/useShampaf';
import type { Soldier } from '@/db/schema';

interface MultiShampafDialogProps {
  open: boolean;
  onClose: () => void;
  soldiers: Soldier[];
}

type SoldierDecision = 'include' | 'skip';

export function MultiShampafDialog({
  open,
  onClose,
  soldiers,
}: MultiShampafDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState(todayString());
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [conflicts, setConflicts] = useState<ShampafConflict[]>([]);
  const [decisions, setDecisions] = useState<Map<string, SoldierDecision>>(new Map());
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredSoldiers = useMemo(() => {
    if (!search.trim()) return soldiers;
    const q = search.trim().toLowerCase();
    return soldiers.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.militaryId && s.militaryId.includes(q))
    );
  }, [soldiers, search]);

  const toggleSoldier = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredSoldiers.map(s => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleCheck = async () => {
    if (selectedIds.size === 0) return;
    setChecking(true);
    try {
      const startDT = startDate + 'T08:00';
      const endDT = endDate + 'T18:00';
      const result = await checkShampafBatchConflicts([...selectedIds], startDT, endDT);
      setConflicts(result);

      const decs = new Map<string, SoldierDecision>();
      for (const sid of selectedIds) {
        const hasConflict = result.some(c => c.soldierId === sid);
        decs.set(sid, hasConflict ? 'skip' : 'include');
      }
      setDecisions(decs);
      setStep(2);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toCreate: { soldierId: string; startDateTime: string; endDateTime: string; orderNumber?: string }[] = [];

      for (const [sid, decision] of decisions) {
        if (decision === 'skip') continue;
        toCreate.push({
          soldierId: sid,
          startDateTime: startDate + 'T08:00',
          endDateTime: endDate + 'T18:00',
          orderNumber: orderNumber || undefined,
        });
      }

      if (toCreate.length > 0) {
        await addShampafEntriesBatch(toCreate);
      }
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setStartDate(todayString());
    setEndDate(todayString());
    setOrderNumber('');
    setSelectedIds(new Set());
    setSearch('');
    setConflicts([]);
    setDecisions(new Map());
    onClose();
  };

  const summary = useMemo(() => {
    let include = 0, skip = 0;
    for (const [, d] of decisions) {
      if (d === 'include') include++;
      else skip++;
    }
    return { include, skip };
  }, [decisions]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            הוספת שמ"פ מרובה
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? 'בחר חיילים ותקופת שמ"פ' : 'בדוק התנגשויות ואשר'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">התחלה</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">סיום</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">מס' פקודה (אופציונלי)</label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="מספר פקודה"
                className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              />
            </div>

            {/* Soldier Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">חיילים ({selectedIds.size} נבחרו)</label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">בחר הכל</Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">נקה</Button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חפש חייל..."
                  className="h-9 w-full rounded-md border border-input bg-transparent pr-8 pl-2 text-sm"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {filteredSoldiers.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSoldier(s.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm flex-1">{s.firstName} {s.lastName}</span>
                    {s.militaryId && (
                      <span className="text-xs text-muted-foreground">{s.militaryId}</span>
                    )}
                  </label>
                ))}
                {filteredSoldiers.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">לא נמצאו חיילים</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {summary.include} יתווספו
              {summary.skip > 0 && `, ${summary.skip} ידולגו`}
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {[...selectedIds].map(sid => {
                const soldier = soldiers.find(s => s.id === sid);
                if (!soldier) return null;
                const sc = conflicts.filter(c => c.soldierId === sid);
                const decision = decisions.get(sid) ?? 'include';

                return (
                  <div key={sid} className="px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      {sc.length === 0 ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium flex-1">
                        {soldier.firstName} {soldier.lastName}
                      </span>
                      {sc.length === 0 && <span className="text-xs text-emerald-500">תקין</span>}
                    </div>

                    {sc.map((c, i) => (
                      <div key={i} className="text-xs text-muted-foreground mr-6">{c.message}</div>
                    ))}

                    {sc.length > 0 && (
                      <div className="flex gap-3 mr-6 mt-1">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`shampaf_decision_${sid}`}
                            checked={decision === 'skip'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'skip'))}
                            className="h-3 w-3"
                          />
                          דלג
                        </label>
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`shampaf_decision_${sid}`}
                            checked={decision === 'include'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'include'))}
                            className="h-3 w-3"
                          />
                          הוסף בכל זאת
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowRight className="h-4 w-4 ml-1" />
              חזור
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>ביטול</Button>
          {step === 1 ? (
            <Button onClick={handleCheck} disabled={selectedIds.size === 0 || checking}>
              {checking ? 'בודק...' : `בדוק והוסף (${selectedIds.size})`}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || summary.include === 0}>
              {saving ? 'מוסיף...' : `הוסף ${summary.include} חיילים`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
