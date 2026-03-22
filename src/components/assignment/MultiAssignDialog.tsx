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
import { noonToday, noonTomorrow } from '@/lib/utils';
import { CREW_ROLES, getCrewRoleLabel } from '@/lib/constants';
import {
  checkBatchConflicts,
  addAssignmentsBatch,
} from '@/hooks/useAssignment';
import type { SoldierConflict } from '@/hooks/useAssignment';
import type { Assignment, Soldier, Tank, CrewRole, AssignmentType, Department } from '@/db/schema';
// Assignment type used in Omit<Assignment, 'id'> for batch creation

interface MultiAssignDialogProps {
  open: boolean;
  onClose: () => void;
  soldiers: Soldier[];
  tanks: Tank[];
  departments: Department[];
}

type SoldierDecision = 'include' | 'override' | 'skip';

export function MultiAssignDialog({
  open,
  onClose,
  soldiers,
  tanks,
  departments,
}: MultiAssignDialogProps) {
  // Step 1: Configure
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<AssignmentType>('tank_role');
  const [tankId, setTankId] = useState('');
  const [role, setRole] = useState('');
  const [missionName, setMissionName] = useState('');
  const [startDT, setStartDT] = useState(noonToday());
  const [endDT, setEndDT] = useState(noonTomorrow());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Step 2: Review
  const [conflicts, setConflicts] = useState<SoldierConflict[]>([]);
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

  const selectAll = () => {
    setSelectedIds(new Set(filteredSoldiers.map(s => s.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleCheck = async () => {
    if (selectedIds.size === 0) return;
    setChecking(true);
    try {
      const result = await checkBatchConflicts(
        [...selectedIds], startDT, endDT,
      );
      setConflicts(result);

      // Set default decisions
      const decs = new Map<string, SoldierDecision>();
      for (const sid of selectedIds) {
        const soldierConflicts = result.filter(c => c.soldierId === sid);
        const hasOverlap = soldierConflicts.some(c => c.type === 'overlapping_assignment');
        decs.set(sid, hasOverlap ? 'skip' : 'include');
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
      const toCreate: Omit<Assignment, 'id'>[] = [];
      const toDelete: string[] = [];

      for (const [sid, decision] of decisions) {
        if (decision === 'skip') continue;

        if (decision === 'override') {
          const overlap = conflicts.find(c => c.soldierId === sid && c.type === 'overlapping_assignment');
          if (overlap?.existingAssignmentId) toDelete.push(overlap.existingAssignmentId);
        }

        toCreate.push({
          soldierId: sid,
          type,
          tankId: type === 'tank_role' ? tankId || undefined : undefined,
          role: type === 'tank_role' && role ? (role as CrewRole) : undefined,
          missionName: type === 'general_mission' ? missionName || undefined : undefined,
          startDateTime: startDT,
          endDateTime: endDT,
        } as Omit<Assignment, 'id'>);
      }

      if (toCreate.length > 0) {
        await addAssignmentsBatch(toCreate, toDelete.length > 0 ? toDelete : undefined);
      }

      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setType('tank_role');
    setTankId('');
    setRole('');
    setMissionName('');
    setStartDT(noonToday());
    setEndDT(noonTomorrow());
    setSelectedIds(new Set());
    setSearch('');
    setConflicts([]);
    setDecisions(new Map());
    onClose();
  };

  const getSoldierConflicts = (sid: string) => conflicts.filter(c => c.soldierId === sid);

  const summary = useMemo(() => {
    let include = 0, skip = 0, override = 0;
    for (const [, d] of decisions) {
      if (d === 'include') include++;
      else if (d === 'skip') skip++;
      else if (d === 'override') override++;
    }
    return { include: include + override, skip, override };
  }, [decisions]);

  // Group tanks by department for the select
  const tankOptions = useMemo(() => {
    const groups: { label: string; tanks: Tank[] }[] = [];
    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const byDept = new Map<string, Tank[]>();
    for (const t of tanks) {
      const key = t.departmentId || '__none__';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(t);
    }
    for (const dept of departments) {
      if (byDept.has(dept.id)) {
        groups.push({ label: deptMap.get(dept.id) || '', tanks: byDept.get(dept.id)! });
      }
    }
    if (byDept.has('__none__')) {
      groups.push({ label: 'ללא מחלקה', tanks: byDept.get('__none__')! });
    }
    return groups;
  }, [tanks, departments]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            שיבוץ מרובה
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? 'בחר חיילים ופרטי שיבוץ' : 'בדוק התנגשויות ואשר'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {/* Assignment Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">סוג שיבוץ</label>
                <select
                  value={type}
                  onChange={e => { setType(e.target.value as AssignmentType); setTankId(''); setRole(''); setMissionName(''); }}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="tank_role">שיבוץ לטנק</option>
                  <option value="general_mission">משימה כללית</option>
                </select>
              </div>

              {type === 'tank_role' ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">רכב</label>
                    <select
                      value={tankId}
                      onChange={e => setTankId(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">בחר רכב...</option>
                      {tankOptions.map(g => (
                        <optgroup key={g.label} label={g.label}>
                          {g.tanks.map(t => (
                            <option key={t.id} value={t.id}>{t.designation}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm font-medium mb-1 block">שם המשימה</label>
                  <input
                    type="text"
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    placeholder="שם המשימה"
                    className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  />
                </div>
              )}
            </div>

            {type === 'tank_role' && (
              <div>
                <label className="text-sm font-medium mb-1 block">תפקיד</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">איש צוות 5</option>
                  {CREW_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">התחלה</label>
                <input
                  type="datetime-local"
                  value={startDT}
                  onChange={e => setStartDT(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">סיום</label>
                <input
                  type="datetime-local"
                  value={endDT}
                  onChange={e => setEndDT(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                />
              </div>
            </div>

            {/* Soldier Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">חיילים ({selectedIds.size} נבחרו)</label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    בחר הכל
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">
                    נקה
                  </Button>
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
                    <span className="text-sm flex-1">
                      {s.firstName} {s.lastName}
                    </span>
                    {s.trainedRole && (
                      <span className="text-xs text-muted-foreground">
                        {getCrewRoleLabel(s.trainedRole)}
                      </span>
                    )}
                    {s.militaryId && (
                      <span className="text-xs text-muted-foreground">
                        {s.militaryId}
                      </span>
                    )}
                  </label>
                ))}
                {filteredSoldiers.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    לא נמצאו חיילים
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Review */
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {summary.include} יישובצו
              {summary.skip > 0 && `, ${summary.skip} ידולגו`}
              {summary.override > 0 && `, ${summary.override} יוחלפו`}
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {[...selectedIds].map(sid => {
                const soldier = soldiers.find(s => s.id === sid);
                if (!soldier) return null;
                const sc = getSoldierConflicts(sid);
                const decision = decisions.get(sid) ?? 'include';
                const hasOverlap = sc.some(c => c.type === 'overlapping_assignment');
                const hasShampaf = sc.some(c => c.type === 'no_shampaf');

                return (
                  <div key={sid} className="px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      {sc.length === 0 ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : hasShampaf ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : hasOverlap ? (
                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}

                      <span className="text-sm font-medium flex-1">
                        {soldier.firstName} {soldier.lastName}
                      </span>

                      {sc.length === 0 && (
                        <span className="text-xs text-emerald-500">תקין</span>
                      )}
                    </div>

                    {/* Conflict details */}
                    {sc.map((c, i) => (
                      <div key={i} className="text-xs text-muted-foreground mr-6">
                        {c.message}
                      </div>
                    ))}

                    {/* Decision controls for overlapping */}
                    {hasOverlap && (
                      <div className="flex gap-3 mr-6 mt-1">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`decision_${sid}`}
                            checked={decision === 'skip'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'skip'))}
                            className="h-3 w-3"
                          />
                          דלג
                        </label>
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`decision_${sid}`}
                            checked={decision === 'override'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'override'))}
                            className="h-3 w-3"
                          />
                          החלף קיים
                        </label>
                      </div>
                    )}

                    {/* Allow skipping for shampaf/vacation warnings too */}
                    {!hasOverlap && sc.length > 0 && (
                      <div className="flex gap-3 mr-6 mt-1">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`decision_${sid}`}
                            checked={decision === 'include'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'include'))}
                            className="h-3 w-3"
                          />
                          שבץ בכל זאת
                        </label>
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name={`decision_${sid}`}
                            checked={decision === 'skip'}
                            onChange={() => setDecisions(prev => new Map(prev).set(sid, 'skip'))}
                            className="h-3 w-3"
                          />
                          דלג
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
          <Button variant="outline" onClick={handleClose}>
            ביטול
          </Button>
          {step === 1 ? (
            <Button
              onClick={handleCheck}
              disabled={selectedIds.size === 0 || checking}
            >
              {checking ? 'בודק...' : `בדוק ושבץ (${selectedIds.size})`}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving || summary.include === 0}
            >
              {saving ? 'משבץ...' : `שבץ ${summary.include} חיילים`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
