import { useState } from 'react';
import { Plus, ShieldCheck, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useTanks,
  useAllCrewAssignments,
  addTank,
  assignCrew,
  unassignCrew,
} from '@/hooks/useTanks';
import { useSoldiers } from '@/hooks/useSoldiers';
import { TANK_STATUSES, CREW_ROLES, getTankStatusLabel, getCrewRoleLabel, getRankLabel } from '@/lib/constants';
import { todayString } from '@/lib/utils';
import type { CrewRole } from '@/db/schema';

export function TanksPage() {
  const tanks = useTanks();
  const allCrew = useAllCrewAssignments();
  const soldiers = useSoldiers();
  const [showAdd, setShowAdd] = useState(false);
  const [showAssignCrew, setShowAssignCrew] = useState<{ tankId: string; role: CrewRole } | null>(null);

  // Add tank form
  const [designation, setDesignation] = useState('');
  const [tankType, setTankType] = useState('מרכבה סימן 4');
  const [tankStatus, setTankStatus] = useState('operational');
  const [tankNotes, setTankNotes] = useState('');

  // Assign crew form
  const [crewSoldierId, setCrewSoldierId] = useState('');

  const getCrewForTank = (tankId: string) => {
    return allCrew?.filter((a) => a.tankId === tankId) ?? [];
  };

  const getSoldierName = (soldierId: string) => {
    const s = soldiers?.find((s) => s.id === soldierId);
    return s ? `${getRankLabel(s.rank)} ${s.firstName} ${s.lastName}` : '';
  };

  const assignedSoldierIds = new Set(allCrew?.map((a) => a.soldierId) ?? []);
  const availableSoldiers = soldiers?.filter((s) => !assignedSoldierIds.has(s.id)) ?? [];

  const handleAddTank = async () => {
    await addTank({
      designation,
      type: tankType,
      status: tankStatus,
      notes: tankNotes || undefined,
    });
    setShowAdd(false);
    setDesignation('');
    setTankType('מרכבה סימן 4');
    setTankStatus('operational');
    setTankNotes('');
  };

  const handleAssignCrew = async () => {
    if (showAssignCrew && crewSoldierId) {
      await assignCrew(showAssignCrew.tankId, {
        soldierId: crewSoldierId,
        role: showAssignCrew.role,
        startDate: todayString(),
      });
      setShowAssignCrew(null);
      setCrewSoldierId('');
    }
  };

  const statusColors: Record<string, string> = {
    operational: 'bg-status-active',
    maintenance: 'bg-status-leave',
    damaged: 'bg-status-medical',
    reserve: 'bg-status-released',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">טנקים</h2>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 me-1" />
          הוספת טנק
        </Button>
      </div>

      {tanks && tanks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tanks.map((tank) => {
            const crew = getCrewForTank(tank.id);
            return (
              <Card key={tank.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      {tank.designation}
                    </CardTitle>
                    <Badge className={`${statusColors[tank.status] ?? 'bg-gray-500'} text-white border-0`}>
                      {getTankStatusLabel(tank.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{tank.type}</p>
                </CardHeader>
                <CardContent>
                  {/* 2x2 Crew grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {CREW_ROLES.map((role) => {
                      const member = crew.find((c) => c.role === role.value);
                      return (
                        <div
                          key={role.value}
                          className={`p-3 rounded-lg border text-center min-h-[70px] flex flex-col items-center justify-center transition-colors ${
                            member
                              ? 'bg-primary/5 border-primary/20'
                              : 'border-dashed border-muted cursor-pointer hover:border-primary/40'
                          }`}
                          onClick={() => {
                            if (!member) {
                              setShowAssignCrew({ tankId: tank.id, role: role.value });
                            }
                          }}
                        >
                          <p className="text-xs text-muted-foreground font-medium mb-1">{role.label}</p>
                          {member ? (
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-medium truncate max-w-[100px]">
                                {getSoldierName(member.soldierId)}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unassignCrew(member.id);
                                }}
                                className="text-muted-foreground hover:text-destructive touch-target p-1"
                                aria-label={`הסר ${getSoldierName(member.soldierId)}`}
                              >
                                <UserMinus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <UserPlus className="h-3 w-3" />
                              <span className="text-xs">שבץ</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {tank.notes && (
                    <p className="text-xs text-muted-foreground mt-3">{tank.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">אין טנקים עדיין</p>
          <p className="text-sm mt-1">לחץ על "הוספת טנק" כדי להתחיל</p>
        </div>
      )}

      {/* Add tank dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת טנק</DialogTitle>
            <DialogDescription>הזן את פרטי הטנק</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>כינוי / מספר</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder='למשל: "401"' />
            </div>
            <div className="space-y-2">
              <Label>סוג</Label>
              <Input value={tankType} onChange={(e) => setTankType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={tankStatus} onValueChange={setTankStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TANK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={tankNotes} onChange={(e) => setTankNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ביטול</Button>
            <Button onClick={handleAddTank} disabled={!designation}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign crew dialog */}
      <Dialog open={!!showAssignCrew} onOpenChange={() => setShowAssignCrew(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              שיבוץ {showAssignCrew ? getCrewRoleLabel(showAssignCrew.role) : ''}
            </DialogTitle>
            <DialogDescription>בחר חייל לשיבוץ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>חייל</Label>
              <Select value={crewSoldierId} onValueChange={setCrewSoldierId}>
                <SelectTrigger><SelectValue placeholder="בחר חייל" /></SelectTrigger>
                <SelectContent>
                  {availableSoldiers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getRankLabel(s.rank)} {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignCrew(null)}>ביטול</Button>
            <Button onClick={handleAssignCrew} disabled={!crewSoldierId}>שבץ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
