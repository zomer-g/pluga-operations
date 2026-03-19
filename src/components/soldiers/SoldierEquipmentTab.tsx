import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useEquipmentAssignments,
  useEquipmentTypes,
  assignEquipment,
  returnEquipment,
} from '@/hooks/useEquipment';
import { getConditionLabel, EQUIPMENT_CONDITIONS } from '@/lib/constants';
import { formatDate, todayString } from '@/lib/utils';

interface Props {
  soldierId: string;
}

export function SoldierEquipmentTab({ soldierId }: Props) {
  const assignments = useEquipmentAssignments(soldierId);
  const equipmentTypes = useEquipmentTypes();
  const [showAssign, setShowAssign] = useState(false);
  const [showReturn, setShowReturn] = useState<string | null>(null);

  // Assign form state
  const [assignTypeId, setAssignTypeId] = useState('');
  const [assignSerial, setAssignSerial] = useState('');
  const [assignCondition, setAssignCondition] = useState('good');
  const [assignNotes, setAssignNotes] = useState('');

  // Return form state
  const [returnCondition, setReturnCondition] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');

  const activeAssignments = assignments?.filter((a) => !a.signedInDate) ?? [];
  const pastAssignments = assignments?.filter((a) => a.signedInDate) ?? [];

  const getTypeName = (typeId: string) => {
    return equipmentTypes?.find((t) => t.id === typeId)?.nameHe ?? 'לא ידוע';
  };

  const selectedType = equipmentTypes?.find((t) => t.id === assignTypeId);

  const handleAssign = async () => {
    await assignEquipment(soldierId, {
      equipmentTypeId: assignTypeId,
      serialNumber: assignSerial || undefined,
      signedOutDate: todayString(),
      condition: assignCondition,
      notes: assignNotes || undefined,
    });
    setShowAssign(false);
    setAssignTypeId('');
    setAssignSerial('');
    setAssignCondition('good');
    setAssignNotes('');
  };

  const handleReturn = async () => {
    if (showReturn) {
      await returnEquipment(showReturn, returnCondition, returnNotes || undefined);
      setShowReturn(null);
      setReturnCondition('good');
      setReturnNotes('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">ציוד חתום</CardTitle>
          <Button size="sm" onClick={() => setShowAssign(true)}>
            <Plus className="h-4 w-4 me-1" />
            חתימה על ציוד
          </Button>
        </CardHeader>
        <CardContent>
          {activeAssignments.length > 0 ? (
            <div className="space-y-3">
              {activeAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{getTypeName(a.equipmentTypeId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.serialNumber && `מק"ט: ${a.serialNumber} | `}
                      חתום מ: {formatDate(a.signedOutDate)} | מצב: {getConditionLabel(a.condition)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReturn(a.id)}
                  >
                    <RotateCcw className="h-4 w-4 me-1" />
                    החזרה
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">אין ציוד חתום כרגע</p>
          )}
        </CardContent>
      </Card>

      {pastAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">היסטוריית ציוד</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded border opacity-70 text-sm">
                  <span>{getTypeName(a.equipmentTypeId)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(a.signedOutDate)} - {formatDate(a.signedInDate!)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>חתימה על ציוד</DialogTitle>
            <DialogDescription>בחר את סוג הציוד והזן פרטים</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>סוג ציוד</Label>
              <Select value={assignTypeId} onValueChange={setAssignTypeId}>
                <SelectTrigger><SelectValue placeholder="בחר ציוד" /></SelectTrigger>
                <SelectContent>
                  {equipmentTypes?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nameHe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedType?.serialNumberRequired && (
              <div className="space-y-2">
                <Label>מספר סידורי</Label>
                <Input value={assignSerial} onChange={(e) => setAssignSerial(e.target.value)} dir="ltr" />
              </div>
            )}
            <div className="space-y-2">
              <Label>מצב</Label>
              <Select value={assignCondition} onValueChange={setAssignCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>ביטול</Button>
            <Button onClick={handleAssign} disabled={!assignTypeId}>חתום</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={!!showReturn} onOpenChange={() => setShowReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>החזרת ציוד</DialogTitle>
            <DialogDescription>עדכן את מצב הציוד בהחזרה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>מצב בהחזרה</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturn(null)}>ביטול</Button>
            <Button onClick={handleReturn}>אשר החזרה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
