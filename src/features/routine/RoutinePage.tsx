import { useState } from 'react';
import { Calendar, Plus, Trash2, Play, Edit3, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useRoutineTemplates,
  addRoutineTemplate,
  updateRoutineTemplate,
  deleteRoutineTemplate,
  applyRoutineToAssignments,
} from './useRoutine';
import { useTanks, addTank } from '@/hooks/useTanks';
import { useSoldiers } from '@/hooks/useSoldiers';
import { getCrewRoleLabel, CREW_ROLES, VEHICLE_CATEGORIES } from '@/lib/constants';
import { noonToday, noonTomorrow } from '@/lib/utils';
import type { RoutineCrewSlot, CrewRole, VehicleCategory } from '@/db/schema';

export function RoutinePage() {
  const templates = useRoutineTemplates();
  const tanks = useTanks();
  const soldiers = useSoldiers();
  const [addOpen, setAddOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehicleCategory, setNewVehicleCategory] = useState<VehicleCategory>('tank');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!templates || !tanks || !soldiers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getSoldierName = (id: string) => {
    const s = soldiers.find(s => s.id === id);
    return s ? `${s.firstName} ${s.lastName}` : 'לא ידוע';
  };

  const getTankName = (id: string) => {
    const t = tanks.find(t => t.id === id);
    return t ? t.designation : 'לא ידוע';
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">שגרת שיבוץ</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setVehicleOpen(true)} className="gap-2">
            <Truck className="h-4 w-4" />
            רכב חדש
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              תבנית חדשה
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>תבנית שגרה חדשה</DialogTitle>
            </DialogHeader>
            <TemplateForm
              tanks={tanks}
              soldiers={soldiers}
              onSave={async (data) => {
                await addRoutineTemplate(data);
                setAddOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        הגדר צוותי ברירת מחדל לכל רכב. לחץ &quot;הפעל&quot; ליצירת שיבוצים אוטומטית.
      </p>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-destructive/10 text-destructive border border-destructive/30'
        }`}>
          {message.text}
        </div>
      )}

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין תבניות שגרה. צור תבנית חדשה כדי להתחיל.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{tmpl.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {getTankName(tmpl.tankId)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Crew slots */}
                <div className="space-y-2">
                  {tmpl.crewSlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">אין צוות מוגדר</p>
                  ) : (
                    tmpl.crewSlots.map((slot, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-card border rounded px-3 py-2">
                        <span className="text-foreground">{getSoldierName(slot.soldierId)}</span>
                        <span className="text-muted-foreground">{getCrewRoleLabel(slot.role)}</span>
                      </div>
                    ))
                  )}
                </div>

                {tmpl.notes && (
                  <p className="text-xs text-muted-foreground">{tmpl.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setApplyOpen(tmpl.id)}
                  >
                    <Play className="h-3 w-3" />
                    הפעל
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(tmpl.id)}
                    aria-label="ערוך תבנית"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (confirm('למחוק תבנית זו?')) {
                        await deleteRoutineTemplate(tmpl.id);
                      }
                    }}
                    aria-label="מחק תבנית"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Apply Dialog */}
      <Dialog open={!!applyOpen} onOpenChange={(open) => !open && setApplyOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>הפעלת שגרה</DialogTitle>
          </DialogHeader>
          <ApplyForm
            templateId={applyOpen}
            onApply={async (templateId, start, end) => {
              try {
                const warnings = await applyRoutineToAssignments(templateId, start, end);
                setApplyOpen(null);
                if (warnings.length > 0) {
                  setMessage({ type: 'success', text: `שיבוצים נוצרו עם ${warnings.length} אזהרות: ${warnings.join(', ')}` });
                } else {
                  setMessage({ type: 'success', text: 'שיבוצים נוצרו בהצלחה!' });
                }
                setTimeout(() => setMessage(null), 5000);
              } catch (err) {
                setMessage({ type: 'error', text: `שגיאה: ${(err as Error).message}` });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>עריכת תבנית</DialogTitle>
          </DialogHeader>
          {editingId && (
            <EditTemplateForm
              templateId={editingId}
              templates={templates}
              tanks={tanks}
              soldiers={soldiers}
              onSave={async (data) => {
                await updateRoutineTemplate(editingId, data);
                setEditingId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Vehicle Dialog */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>צור רכב חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם/מספר רכב</Label>
              <Input value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} placeholder="377" />
            </div>
            <div>
              <Label>סוג רכב</Label>
              <Input value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)} placeholder="מרכבה 4" />
            </div>
            <div>
              <Label>קטגוריה</Label>
              <Select value={newVehicleCategory} onValueChange={(v) => setNewVehicleCategory(v as VehicleCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={async () => {
                if (!newVehicleName.trim()) return;
                await addTank({
                  designation: newVehicleName.trim(),
                  type: newVehicleType.trim() || newVehicleCategory,
                  vehicleCategory: newVehicleCategory,
                  status: 'operational',
                });
                setNewVehicleName('');
                setNewVehicleType('');
                setNewVehicleCategory('tank');
                setVehicleOpen(false);
              }}
              disabled={!newVehicleName.trim()}
              className="w-full"
            >
              צור רכב
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Template Form =====

function TemplateForm({
  tanks,
  soldiers,
  onSave,
  initial,
}: {
  tanks: { id: string; designation: string }[];
  soldiers: { id: string; firstName: string; lastName: string }[];
  onSave: (data: { name: string; tankId: string; crewSlots: RoutineCrewSlot[]; notes?: string }) => Promise<void>;
  initial?: { name: string; tankId: string; crewSlots: RoutineCrewSlot[]; notes?: string };
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tankId, setTankId] = useState(initial?.tankId ?? '');
  const [slots, setSlots] = useState<RoutineCrewSlot[]>(initial?.crewSlots ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const addSlot = () => {
    setSlots([...slots, { role: 'driver' as CrewRole, soldierId: '' }]);
  };

  const updateSlot = (index: number, field: keyof RoutineCrewSlot, value: string) => {
    const next = [...slots];
    next[index] = { ...next[index], [field]: value } as RoutineCrewSlot;
    setSlots(next);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !tankId) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      tankId,
      crewSlots: slots.filter(s => s.soldierId),
      notes: notes.trim() || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>שם התבנית</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שגרת אימון" />
      </div>
      <div>
        <Label>רכב</Label>
        <Select value={tankId} onValueChange={setTankId}>
          <SelectTrigger><SelectValue placeholder="בחר רכב..." /></SelectTrigger>
          <SelectContent>
            {tanks.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.designation}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>צוות</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSlot} className="gap-1">
            <Plus className="h-3 w-3" />
            הוסף
          </Button>
        </div>
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={slot.role} onValueChange={(v) => updateSlot(i, 'role', v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREW_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={slot.soldierId || '__none__'} onValueChange={(v) => updateSlot(i, 'soldierId', v === '__none__' ? '' : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="בחר חייל..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">בחר חייל...</SelectItem>
                  {soldiers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeSlot(i)} aria-label="הסר">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>הערות</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button onClick={handleSubmit} disabled={saving || !name.trim() || !tankId}>
        {saving ? 'שומר...' : 'שמור'}
      </Button>
    </div>
  );
}

function EditTemplateForm({
  templateId,
  templates,
  tanks,
  soldiers,
  onSave,
}: {
  templateId: string;
  templates: { id: string; name: string; tankId: string; crewSlots: RoutineCrewSlot[]; notes?: string }[];
  tanks: { id: string; designation: string }[];
  soldiers: { id: string; firstName: string; lastName: string }[];
  onSave: (data: Partial<{ name: string; tankId: string; crewSlots: RoutineCrewSlot[]; notes?: string }>) => Promise<void>;
}) {
  const tmpl = templates.find(t => t.id === templateId);
  if (!tmpl) return <p className="text-muted-foreground">תבנית לא נמצאה</p>;

  return (
    <TemplateForm
      tanks={tanks}
      soldiers={soldiers}
      initial={{ name: tmpl.name, tankId: tmpl.tankId, crewSlots: tmpl.crewSlots, notes: tmpl.notes }}
      onSave={onSave}
    />
  );
}

// ===== Apply Form =====

function ApplyForm({
  templateId,
  onApply,
}: {
  templateId: string | null;
  onApply: (templateId: string, start: string, end: string) => Promise<void>;
}) {
  const [startDT, setStartDT] = useState(noonToday());
  const [endDT, setEndDT] = useState(noonTomorrow());
  const [applying, setApplying] = useState(false);

  if (!templateId) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        השיבוצים ייווצרו על פי התבנית עבור טווח התאריכים שנבחר.
      </p>
      <div>
        <Label>התחלה</Label>
        <Input type="datetime-local" value={startDT} onChange={(e) => setStartDT(e.target.value)} />
      </div>
      <div>
        <Label>סיום</Label>
        <Input type="datetime-local" value={endDT} onChange={(e) => setEndDT(e.target.value)} />
      </div>
      <Button
        onClick={async () => {
          setApplying(true);
          await onApply(templateId, startDT, endDT);
          setApplying(false);
        }}
        disabled={applying || !startDT || !endDT}
        className="gap-2"
      >
        <Play className="h-4 w-4" />
        {applying ? 'יוצר שיבוצים...' : 'צור שיבוצים'}
      </Button>
    </div>
  );
}
