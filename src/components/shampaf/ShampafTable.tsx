import { useState } from 'react';
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Plus,
  Save,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTimeShort, generateId, noonToday, noonTomorrow } from '@/lib/utils';
import {
  addShampafEntry,
  updateShampafEntry,
  deleteShampafEntry,
  addShampafVacation,
  updateShampafVacation,
  deleteShampafVacation,
} from '@/hooks/useShampaf';
import type { ShampafEntry, ShampafVacation, Soldier } from '@/db/schema';

interface ShampafTableProps {
  entries: ShampafEntry[];
  vacations: ShampafVacation[];
  soldiers: Soldier[];
}

interface EditingData {
  soldierId: string;
  startDateTime: string;
  endDateTime: string;
  orderNumber: string;
  notes: string;
}

interface VacationEditingData {
  startDateTime: string;
  endDateTime: string;
  reason: string;
  notes: string;
}

function getSoldierName(soldierId: string, soldiers: Soldier[]): string {
  const s = soldiers.find((s) => s.id === soldierId);
  return s ? `${s.firstName} ${s.lastName}` : '---';
}

export function ShampafTable({ entries, vacations, soldiers }: ShampafTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Vacation inline editing
  const [editingVacId, setEditingVacId] = useState<string | null>(null);
  const [editingVacData, setEditingVacData] = useState<VacationEditingData | null>(null);
  const [isNewVac, setIsNewVac] = useState(false);
  const [newVacParentId, setNewVacParentId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getVacationCount = (entryId: string) =>
    vacations.filter((v) => v.shampafEntryId === entryId).length;

  // --- Entry editing ---

  const startAdd = () => {
    const tempId = `__new_${generateId()}`;
    setEditingId(tempId);
    setIsNew(true);
    setEditingData({
      soldierId: '',
      startDateTime: noonToday(),
      endDateTime: noonTomorrow(),
      orderNumber: '',
      notes: '',
    });
  };

  const startEdit = (entry: ShampafEntry) => {
    setEditingId(entry.id);
    setIsNew(false);
    setEditingData({
      soldierId: entry.soldierId,
      startDateTime: entry.startDateTime,
      endDateTime: entry.endDateTime,
      orderNumber: entry.orderNumber ?? '',
      notes: entry.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
    setIsNew(false);
  };

  const saveEntry = async () => {
    if (!editingData || !editingData.soldierId) return;

    if (isNew) {
      await addShampafEntry({
        soldierId: editingData.soldierId,
        startDateTime: editingData.startDateTime,
        endDateTime: editingData.endDateTime,
        orderNumber: editingData.orderNumber || undefined,
        notes: editingData.notes || undefined,
      });
    } else if (editingId) {
      await updateShampafEntry(editingId, {
        startDateTime: editingData.startDateTime,
        endDateTime: editingData.endDateTime,
        orderNumber: editingData.orderNumber || undefined,
        notes: editingData.notes || undefined,
      });
    }
    cancelEdit();
  };

  const handleDelete = async (id: string) => {
    await deleteShampafEntry(id);
  };

  // --- Vacation editing ---

  const startAddVacation = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const tempId = `__newvac_${generateId()}`;
    setEditingVacId(tempId);
    setIsNewVac(true);
    setNewVacParentId(entryId);
    setEditingVacData({
      startDateTime: noonToday(),
      endDateTime: noonTomorrow(),
      reason: '',
      notes: '',
    });
  };

  const startEditVacation = (vac: ShampafVacation) => {
    setEditingVacId(vac.id);
    setIsNewVac(false);
    setNewVacParentId(vac.shampafEntryId);
    setEditingVacData({
      startDateTime: vac.startDateTime,
      endDateTime: vac.endDateTime,
      reason: vac.reason ?? '',
      notes: vac.notes ?? '',
    });
  };

  const cancelVacEdit = () => {
    setEditingVacId(null);
    setEditingVacData(null);
    setIsNewVac(false);
    setNewVacParentId(null);
  };

  const saveVacation = async () => {
    if (!editingVacData || !newVacParentId) return;

    const entry = entries.find((e) => e.id === newVacParentId);
    if (!entry) return;

    if (isNewVac) {
      await addShampafVacation({
        shampafEntryId: newVacParentId,
        soldierId: entry.soldierId,
        startDateTime: editingVacData.startDateTime,
        endDateTime: editingVacData.endDateTime,
        reason: editingVacData.reason || undefined,
        notes: editingVacData.notes || undefined,
      });
    } else if (editingVacId) {
      await updateShampafVacation(editingVacId, {
        startDateTime: editingVacData.startDateTime,
        endDateTime: editingVacData.endDateTime,
        reason: editingVacData.reason || undefined,
        notes: editingVacData.notes || undefined,
      });
    }
    cancelVacEdit();
  };

  const handleDeleteVacation = async (id: string) => {
    await deleteShampafVacation(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={startAdd}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף שמ"פ
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-right py-2 px-2 font-medium w-8"></th>
              <th className="text-right py-2 px-2 font-medium">חייל</th>
              <th className="text-right py-2 px-2 font-medium">מס' פקודה</th>
              <th className="text-right py-2 px-2 font-medium">התחלה</th>
              <th className="text-right py-2 px-2 font-medium">סיום</th>
              <th className="text-right py-2 px-2 font-medium">חופשות</th>
              <th className="text-right py-2 px-2 font-medium w-24">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {/* New entry row */}
            {isNew && editingId && editingData && (
              <tr className="border-b bg-muted/30">
                <td className="py-1 px-2"></td>
                <td className="py-1 px-2">
                  <select
                    value={editingData.soldierId}
                    onChange={(e) =>
                      setEditingData({ ...editingData, soldierId: e.target.value })
                    }
                    className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">בחר חייל...</option>
                    {soldiers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2">
                  <input
                    type="text"
                    value={editingData.orderNumber}
                    onChange={(e) =>
                      setEditingData({ ...editingData, orderNumber: e.target.value })
                    }
                    placeholder="מס' פקודה"
                    className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    type="datetime-local"
                    value={editingData.startDateTime}
                    onChange={(e) =>
                      setEditingData({ ...editingData, startDateTime: e.target.value })
                    }
                    className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    type="datetime-local"
                    value={editingData.endDateTime}
                    onChange={(e) =>
                      setEditingData({ ...editingData, endDateTime: e.target.value })
                    }
                    className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </td>
                <td className="py-1 px-2 text-center">-</td>
                <td className="py-1 px-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={saveEntry} title="שמור">
                      <Save className="h-4 w-4 text-emerald-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={cancelEdit} title="בטל">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {entries.map((entry) => {
              const isEditing = editingId === entry.id && !isNew;
              const expanded = expandedIds.has(entry.id);
              const entryVacations = vacations.filter(
                (v) => v.shampafEntryId === entry.id
              );

              return (
                <tbody key={entry.id}>
                  <tr className={cn('border-b', isEditing && 'bg-muted/30')}>
                    {/* Expand toggle */}
                    <td className="py-1 px-2">
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="p-1 rounded hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {/* Soldier name (always read-only for existing) */}
                    <td className="py-1 px-2 min-h-[44px]">
                      <span className="leading-[44px]">
                        {getSoldierName(entry.soldierId, soldiers)}
                      </span>
                    </td>

                    {/* Order number */}
                    <td className="py-1 px-2">
                      {isEditing && editingData ? (
                        <input
                          type="text"
                          value={editingData.orderNumber}
                          onChange={(e) =>
                            setEditingData({ ...editingData, orderNumber: e.target.value })
                          }
                          className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <span className="leading-[44px]">
                          {entry.orderNumber || '-'}
                        </span>
                      )}
                    </td>

                    {/* Start */}
                    <td className="py-1 px-2">
                      {isEditing && editingData ? (
                        <input
                          type="datetime-local"
                          value={editingData.startDateTime}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              startDateTime: e.target.value,
                            })
                          }
                          className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <span className="leading-[44px]">
                          {formatDateTimeShort(entry.startDateTime)}
                        </span>
                      )}
                    </td>

                    {/* End */}
                    <td className="py-1 px-2">
                      {isEditing && editingData ? (
                        <input
                          type="datetime-local"
                          value={editingData.endDateTime}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              endDateTime: e.target.value,
                            })
                          }
                          className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <span className="leading-[44px]">
                          {formatDateTimeShort(entry.endDateTime)}
                        </span>
                      )}
                    </td>

                    {/* Vacation count */}
                    <td className="py-1 px-2 text-center">
                      <span className="leading-[44px]">
                        {getVacationCount(entry.id)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-1 px-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={saveEntry}
                            title="שמור"
                          >
                            <Save className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEdit}
                            title="בטל"
                          >
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(entry)}
                            title="ערוך"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(entry.id)}
                            title="מחק"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expanded vacation rows */}
                  {expanded && (
                    <>
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="py-1 px-6">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              חופשות
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => startAddVacation(entry.id)}
                            >
                              <Plus className="h-3 w-3 ml-1" />
                              הוסף חופשה
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* New vacation row */}
                      {isNewVac &&
                        newVacParentId === entry.id &&
                        editingVacData && (
                          <tr className="bg-amber-500/5 border-b">
                            <td></td>
                            <td className="py-1 px-2" colSpan={2}>
                              <input
                                type="text"
                                value={editingVacData.reason}
                                onChange={(e) =>
                                  setEditingVacData({
                                    ...editingVacData,
                                    reason: e.target.value,
                                  })
                                }
                                placeholder="סיבה"
                                className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="datetime-local"
                                value={editingVacData.startDateTime}
                                onChange={(e) =>
                                  setEditingVacData({
                                    ...editingVacData,
                                    startDateTime: e.target.value,
                                  })
                                }
                                className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="datetime-local"
                                value={editingVacData.endDateTime}
                                onChange={(e) =>
                                  setEditingVacData({
                                    ...editingVacData,
                                    endDateTime: e.target.value,
                                  })
                                }
                                className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </td>
                            <td></td>
                            <td className="py-1 px-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={saveVacation}
                                  title="שמור"
                                >
                                  <Save className="h-4 w-4 text-emerald-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cancelVacEdit}
                                  title="בטל"
                                >
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}

                      {entryVacations.map((vac) => {
                        const isVacEditing =
                          editingVacId === vac.id && !isNewVac;
                        return (
                          <tr
                            key={vac.id}
                            className={cn(
                              'border-b bg-amber-500/5',
                              isVacEditing && 'bg-amber-500/10'
                            )}
                          >
                            <td></td>
                            <td className="py-1 px-2" colSpan={2}>
                              {isVacEditing && editingVacData ? (
                                <input
                                  type="text"
                                  value={editingVacData.reason}
                                  onChange={(e) =>
                                    setEditingVacData({
                                      ...editingVacData,
                                      reason: e.target.value,
                                    })
                                  }
                                  placeholder="סיבה"
                                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              ) : (
                                <span className="text-xs leading-[44px]">
                                  {vac.reason || 'חופשה'}
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2">
                              {isVacEditing && editingVacData ? (
                                <input
                                  type="datetime-local"
                                  value={editingVacData.startDateTime}
                                  onChange={(e) =>
                                    setEditingVacData({
                                      ...editingVacData,
                                      startDateTime: e.target.value,
                                    })
                                  }
                                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              ) : (
                                <span className="text-xs leading-[44px]">
                                  {formatDateTimeShort(vac.startDateTime)}
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2">
                              {isVacEditing && editingVacData ? (
                                <input
                                  type="datetime-local"
                                  value={editingVacData.endDateTime}
                                  onChange={(e) =>
                                    setEditingVacData({
                                      ...editingVacData,
                                      endDateTime: e.target.value,
                                    })
                                  }
                                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              ) : (
                                <span className="text-xs leading-[44px]">
                                  {formatDateTimeShort(vac.endDateTime)}
                                </span>
                              )}
                            </td>
                            <td></td>
                            <td className="py-1 px-2">
                              {isVacEditing ? (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={saveVacation}
                                    title="שמור"
                                  >
                                    <Save className="h-4 w-4 text-emerald-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelVacEdit}
                                    title="בטל"
                                  >
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditVacation(vac)}
                                    title="ערוך"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteVacation(vac.id)}
                                    title="מחק"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {entryVacations.length === 0 &&
                        !(isNewVac && newVacParentId === entry.id) && (
                          <tr className="bg-muted/10">
                            <td colSpan={7} className="py-2 px-6 text-center">
                              <span className="text-xs text-muted-foreground">
                                אין חופשות
                              </span>
                            </td>
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
