import { useState } from 'react';
import {
  Pencil, Trash2, ChevronDown, ChevronLeft,
  Plus, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatDate, generateId, todayString } from '@/lib/utils';
import {
  addShampafEntry, updateShampafEntry, deleteShampafEntry,
  addShampafVacation, updateShampafVacation, deleteShampafVacation,
} from '@/hooks/useShampaf';
import type { ShampafEntry, ShampafVacation, Soldier } from '@/db/schema';

interface ShampafTableProps {
  entries: ShampafEntry[];
  vacations: ShampafVacation[];
  soldiers: Soldier[];
}

function getSoldierName(soldierId: string, soldiers: Soldier[]): string {
  const s = soldiers.find((s) => s.id === soldierId);
  return s ? `${s.firstName} ${s.lastName}` : '---';
}

function toDateOnly(dt: string): string {
  return dt.split('T')[0] ?? dt;
}

const inputClass = 'h-9 w-full rounded border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

export function ShampafTable({ entries, vacations, soldiers }: ShampafTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Edit state
  const [soldierId, setSoldierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  // Vacation edit state
  const [editingVacId, setEditingVacId] = useState<string | null>(null);
  const [isNewVac, setIsNewVac] = useState(false);
  const [vacParentId, setVacParentId] = useState<string | null>(null);
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacReason, setVacReason] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getVacCount = (entryId: string) =>
    vacations.filter((v) => v.shampafEntryId === entryId).length;

  // === Entry CRUD ===
  const startAdd = () => {
    setEditingId(`__new_${generateId()}`);
    setIsNew(true);
    setSoldierId('');
    setStartDate(todayString());
    setEndDate(todayString());
    setOrderNumber('');
  };

  const startEdit = (e: ShampafEntry) => {
    setEditingId(e.id);
    setIsNew(false);
    setSoldierId(e.soldierId);
    setStartDate(toDateOnly(e.startDateTime));
    setEndDate(toDateOnly(e.endDateTime));
    setOrderNumber(e.orderNumber ?? '');
  };

  const cancelEdit = () => { setEditingId(null); setIsNew(false); };

  const saveEntry = async () => {
    if (!soldierId) return;
    if (isNew) {
      await addShampafEntry({
        soldierId,
        startDateTime: startDate + 'T08:00',
        endDateTime: endDate + 'T18:00',
        orderNumber: orderNumber || undefined,
      });
    } else if (editingId) {
      await updateShampafEntry(editingId, {
        startDateTime: startDate + 'T08:00',
        endDateTime: endDate + 'T18:00',
        orderNumber: orderNumber || undefined,
      });
    }
    cancelEdit();
  };

  // === Vacation CRUD ===
  const startAddVac = (entryId: string) => {
    setEditingVacId(`__newv_${generateId()}`);
    setIsNewVac(true);
    setVacParentId(entryId);
    setVacStart(todayString());
    setVacEnd(todayString());
    setVacReason('');
    if (!expandedIds.has(entryId)) toggleExpand(entryId);
  };

  const startEditVac = (v: ShampafVacation) => {
    setEditingVacId(v.id);
    setIsNewVac(false);
    setVacParentId(v.shampafEntryId);
    setVacStart(toDateOnly(v.startDateTime));
    setVacEnd(toDateOnly(v.endDateTime));
    setVacReason(v.reason ?? '');
  };

  const cancelVacEdit = () => { setEditingVacId(null); setIsNewVac(false); setVacParentId(null); };

  const saveVac = async () => {
    if (!vacParentId) return;
    const parent = entries.find((e) => e.id === vacParentId);
    if (!parent) return;
    if (isNewVac) {
      await addShampafVacation({
        shampafEntryId: vacParentId,
        soldierId: parent.soldierId,
        startDateTime: vacStart + 'T08:00',
        endDateTime: vacEnd + 'T18:00',
        reason: vacReason || undefined,
      });
    } else if (editingVacId) {
      await updateShampafVacation(editingVacId, {
        startDateTime: vacStart + 'T08:00',
        endDateTime: vacEnd + 'T18:00',
        reason: vacReason || undefined,
      });
    }
    cancelVacEdit();
  };

  // Sort entries by soldier name
  const sortedEntries = [...entries].sort((a, b) => {
    const nameA = getSoldierName(a.soldierId, soldiers);
    const nameB = getSoldierName(b.soldierId, soldiers);
    return nameA.localeCompare(nameB, 'he');
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={startAdd}>
          <Plus className="h-4 w-4 me-1" />
          הוסף שמ"פ
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm table-fixed min-w-[640px]">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-14" />
            <col className="w-20" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-card border-b">
              <th className="py-3 px-2"></th>
              <th className="text-right py-3 px-3 font-medium">חייל</th>
              <th className="text-right py-3 px-3 font-medium">התחלה</th>
              <th className="text-right py-3 px-3 font-medium">סיום</th>
              <th className="text-right py-3 px-3 font-medium">מס' פקודה</th>
              <th className="text-center py-3 px-2 font-medium">חופשות</th>
              <th className="text-center py-3 px-2 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {/* New entry row */}
            {isNew && editingId && (
              <tr className="border-b bg-primary/5">
                <td className="py-2 px-2"></td>
                <td className="py-2 px-3">
                  <select value={soldierId} onChange={(e) => setSoldierId(e.target.value)} className={inputClass}>
                    <option value="">בחר חייל...</option>
                    {soldiers.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                </td>
                <td className="py-2 px-3">
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </td>
                <td className="py-2 px-3">
                  <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className={inputClass} placeholder="-" />
                </td>
                <td className="py-2 px-2 text-center text-muted-foreground">-</td>
                <td className="py-2 px-2">
                  <div className="flex justify-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveEntry}><Check className="h-4 w-4 text-emerald-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                </td>
              </tr>
            )}

            {sortedEntries.map((entry) => {
              const isEditing = editingId === entry.id && !isNew;
              const expanded = expandedIds.has(entry.id);
              const entryVacs = vacations.filter((v) => v.shampafEntryId === entry.id);

              return (
                <tbody key={entry.id}>
                  <tr className={cn('border-b hover:bg-card/50 transition-colors', isEditing && 'bg-primary/5')}>
                    <td className="py-2 px-2">
                      <button onClick={() => toggleExpand(entry.id)} className="p-1 rounded hover:bg-muted touch-target flex items-center justify-center">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="py-2 px-3 font-medium truncate">
                      {getSoldierName(entry.soldierId, soldiers)}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                      ) : (
                        formatDate(toDateOnly(entry.startDateTime))
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                      ) : (
                        formatDate(toDateOnly(entry.endDateTime))
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className={inputClass} />
                      ) : (
                        <span className="text-muted-foreground">{entry.orderNumber || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[24px] rounded-full px-1.5 py-0.5 text-xs font-medium',
                        getVacCount(entry.id) > 0 ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground'
                      )}>
                        {getVacCount(entry.id)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {isEditing ? (
                        <div className="flex justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveEntry}><Check className="h-4 w-4 text-emerald-500" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="h-4 w-4 text-muted-foreground" /></Button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteShampafEntry(entry.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expanded vacation section */}
                  {expanded && (
                    <>
                      <tr className="bg-amber-500/5">
                        <td colSpan={7} className="py-1.5 px-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-amber-400">חופשות — {getSoldierName(entry.soldierId, soldiers)}</span>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startAddVac(entry.id)}>
                              <Plus className="h-3 w-3 me-1" />חופשה
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* New vacation row */}
                      {isNewVac && vacParentId === entry.id && (
                        <tr className="border-b bg-amber-500/10">
                          <td></td>
                          <td className="py-1.5 px-3">
                            <input type="text" value={vacReason} onChange={(e) => setVacReason(e.target.value)} placeholder="סיבה" className={inputClass} />
                          </td>
                          <td className="py-1.5 px-3">
                            <input type="date" value={vacStart} onChange={(e) => setVacStart(e.target.value)} className={inputClass} />
                          </td>
                          <td className="py-1.5 px-3">
                            <input type="date" value={vacEnd} onChange={(e) => setVacEnd(e.target.value)} className={inputClass} />
                          </td>
                          <td colSpan={2}></td>
                          <td className="py-1.5 px-2">
                            <div className="flex justify-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveVac}><Check className="h-4 w-4 text-emerald-500" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelVacEdit}><X className="h-4 w-4 text-muted-foreground" /></Button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {entryVacs.map((vac) => {
                        const isVacEditing = editingVacId === vac.id && !isNewVac;
                        return (
                          <tr key={vac.id} className={cn('border-b bg-amber-500/5', isVacEditing && 'bg-amber-500/10')}>
                            <td></td>
                            <td className="py-1.5 px-3 text-xs">
                              {isVacEditing ? (
                                <input type="text" value={vacReason} onChange={(e) => setVacReason(e.target.value)} className={inputClass} />
                              ) : (
                                <span className="text-amber-300">{vac.reason || 'חופשה'}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-xs">
                              {isVacEditing ? (
                                <input type="date" value={vacStart} onChange={(e) => setVacStart(e.target.value)} className={inputClass} />
                              ) : formatDate(toDateOnly(vac.startDateTime))}
                            </td>
                            <td className="py-1.5 px-3 text-xs">
                              {isVacEditing ? (
                                <input type="date" value={vacEnd} onChange={(e) => setVacEnd(e.target.value)} className={inputClass} />
                              ) : formatDate(toDateOnly(vac.endDateTime))}
                            </td>
                            <td colSpan={2}></td>
                            <td className="py-1.5 px-2">
                              {isVacEditing ? (
                                <div className="flex justify-center gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveVac}><Check className="h-3.5 w-3.5 text-emerald-500" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelVacEdit}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditVac(vac)}><Pencil className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteShampafVacation(vac.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {entryVacs.length === 0 && !(isNewVac && vacParentId === entry.id) && (
                        <tr className="bg-amber-500/5">
                          <td colSpan={7} className="py-2 text-center text-xs text-muted-foreground">אין חופשות</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              );
            })}
          </tbody>

          {entries.length === 0 && !isNew && (
            <tbody>
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <p>אין רשומות שמ"פ</p>
                  <p className="text-xs mt-1">לחץ "הוסף שמ"פ" להתחלה</p>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
