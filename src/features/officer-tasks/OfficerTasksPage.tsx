import { useState, useMemo } from 'react';
import { ClipboardList, Plus, Calendar, Truck } from 'lucide-react';
import { useAssignments, deleteAssignment, addAssignment } from '@/hooks/useAssignment';
import { useSoldiers } from '@/hooks/useSoldiers';
import { useTanks, addTank } from '@/hooks/useTanks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VEHICLE_CATEGORIES } from '@/lib/constants';
import { TaskCard } from './components/TaskCard';
import { QuickAssignSheet } from './components/QuickAssignSheet';
import type { Assignment, CrewRole, VehicleCategory } from '@/db/schema';

export function OfficerTasksPage() {
  const assignments = useAssignments();
  const soldiers = useSoldiers();
  const tanks = useTanks();
  const [assignOpen, setAssignOpen] = useState(false);
  const [reassignData, setReassignData] = useState<Assignment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehicleCategory, setNewVehicleCategory] = useState<VehicleCategory>('tank');

  // Filter to future assignments only
  const futureAssignments = useMemo(() => {
    if (!assignments) return undefined;
    const now = new Date().toISOString();
    return assignments
      .filter(a => a.endDateTime > now)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  }, [assignments]);

  // Show page structure even while loading
  const isLoading = futureAssignments === undefined || soldiers === undefined || tanks === undefined;
  const safeAssignments = futureAssignments ?? [];
  const safeSoldiers = soldiers ?? [];
  const safeTanks = tanks ?? [];

  const handleComplete = async (id: string) => {
    await deleteAssignment(id);
    setMessage('משימה הושלמה');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReassign = (assignment: Assignment) => {
    setReassignData(assignment);
  };

  const handleNewAssignment = async (data: {
    soldierId: string;
    type: 'tank_role' | 'general_mission';
    tankId?: string;
    role?: CrewRole;
    missionName?: string;
    startDateTime: string;
    endDateTime: string;
  }) => {
    if (reassignData) {
      await deleteAssignment(reassignData.id);
      setReassignData(null);
    }
    await addAssignment(data);
    setMessage('שיבוץ נוצר בהצלחה');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateVehicle = async () => {
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
    setMessage('רכב נוצר בהצלחה');
    setTimeout(() => setMessage(null), 3000);
  };

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Assignment[]> = {};
    for (const a of safeAssignments) {
      const dateKey = a.startDateTime.split('T')[0] ?? '';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey]!.push(a);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [safeAssignments]);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) return 'היום';
    if (d.getTime() === tomorrow.getTime()) return 'מחר';
    return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
  };

  return (
    <div className="min-h-full pb-24" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">משימות קצין תורן</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setVehicleOpen(true)} className="gap-1">
              <Truck className="h-3 w-3" />
              רכב חדש
            </Button>
            <span className="text-sm text-muted-foreground">
              {safeAssignments.length} משימות
            </span>
          </div>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-green-900/30 text-green-300 border border-green-700/50 text-sm text-center">
          {message}
        </div>
      )}

      {/* Task list */}
      <div className="px-4 py-3 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium">אין משימות עתידיות</p>
            <p className="text-muted-foreground text-sm mt-1">לחץ + ליצירת שיבוץ חדש</p>
          </div>
        ) : (
          grouped.map(([date, tasks]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 sticky top-14 bg-background/95 py-1 z-[5]">
                {formatDateLabel(date)} • {tasks.length} משימות
              </h2>
              <div className="space-y-3">
                {tasks.map((a) => (
                  <TaskCard
                    key={a.id}
                    assignment={a}
                    soldier={safeSoldiers.find(s => s.id === a.soldierId)}
                    tank={safeTanks.find(t => t.id === a.tankId)}
                    onComplete={handleComplete}
                    onReassign={handleReassign}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setAssignOpen(true)}
        className="fixed bottom-20 end-4 md:bottom-8 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform touch-target"
        aria-label="שיבוץ חדש"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Quick Assign Sheet */}
      <QuickAssignSheet
        open={assignOpen || !!reassignData}
        onClose={() => { setAssignOpen(false); setReassignData(null); }}
        soldiers={safeSoldiers}
        tanks={safeTanks}
        onAssign={handleNewAssignment}
        prefill={reassignData ? {
          soldierId: reassignData.soldierId,
          tankId: reassignData.tankId,
          role: reassignData.role,
          startDateTime: reassignData.startDateTime,
          endDateTime: reassignData.endDateTime,
        } : undefined}
      />

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
            <Button onClick={handleCreateVehicle} disabled={!newVehicleName.trim()} className="w-full">
              צור רכב
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
