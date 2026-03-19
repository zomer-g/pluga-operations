import { useState } from 'react';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useEquipmentTypes,
  useActiveAssignments,
  addEquipmentType,
} from '@/hooks/useEquipment';
import { useSoldiers } from '@/hooks/useSoldiers';
import { EQUIPMENT_CATEGORIES, getCategoryLabel, getConditionLabel } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export function EquipmentPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showAddType, setShowAddType] = useState(false);
  const [viewMode, setViewMode] = useState<'types' | 'assignments'>('types');

  const equipmentTypes = useEquipmentTypes(categoryFilter || undefined);
  const activeAssignments = useActiveAssignments();
  const soldiers = useSoldiers();

  // Add type form
  const [typeName, setTypeName] = useState('');
  const [typeNameHe, setTypeNameHe] = useState('');
  const [typeCategory, setTypeCategory] = useState('');
  const [typeSerialReq, setTypeSerialReq] = useState(false);
  const [typeDesc, setTypeDesc] = useState('');

  const getSoldierName = (soldierId: string) => {
    const s = soldiers?.find((s) => s.id === soldierId);
    return s ? `${s.firstName} ${s.lastName}` : 'לא ידוע';
  };

  const getTypeName = (typeId: string) => {
    return equipmentTypes?.find((t) => t.id === typeId)?.nameHe ?? 'לא ידוע';
  };

  const getAssignmentCount = (typeId: string) => {
    return activeAssignments?.filter((a) => a.equipmentTypeId === typeId).length ?? 0;
  };

  const handleAddType = async () => {
    await addEquipmentType({
      name: typeName,
      nameHe: typeNameHe,
      category: typeCategory,
      serialNumberRequired: typeSerialReq,
      description: typeDesc || undefined,
    });
    setShowAddType(false);
    setTypeName('');
    setTypeNameHe('');
    setTypeCategory('');
    setTypeSerialReq(false);
    setTypeDesc('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ציוד</h2>
        <Button onClick={() => setShowAddType(true)}>
          <Plus className="h-4 w-4 me-1" />
          סוג ציוד חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'types' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('types')}
          >
            קטלוג
          </Button>
          <Button
            variant={viewMode === 'assignments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('assignments')}
          >
            חתימות פעילות
          </Button>
        </div>
        <Select value={categoryFilter || '__all__'} onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">הכל</SelectItem>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Equipment types catalog */}
      {viewMode === 'types' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipmentTypes && equipmentTypes.length > 0 ? (
            equipmentTypes.map((type) => (
              <Card key={type.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{type.nameHe}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{type.name}</p>
                    </div>
                    <Badge variant="outline">{getCategoryLabel(type.category)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      חתומים: <span className="font-semibold text-foreground">{getAssignmentCount(type.id)}</span>
                    </span>
                    {type.serialNumberRequired && (
                      <Badge variant="secondary" className="text-xs">דרוש מק"ט</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>אין סוגי ציוד בקטגוריה זו</p>
            </div>
          )}
        </div>
      )}

      {/* Active assignments */}
      {viewMode === 'assignments' && (
        <div className="space-y-3">
          {activeAssignments && activeAssignments.length > 0 ? (
            activeAssignments.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{getTypeName(a.equipmentTypeId)}</p>
                      <p className="text-sm text-muted-foreground">
                        חייל: {getSoldierName(a.soldierId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.serialNumber && `מק"ט: ${a.serialNumber} | `}
                        חתום מ: {formatDate(a.signedOutDate)} | מצב: {getConditionLabel(a.condition)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>אין חתימות ציוד פעילות</p>
            </div>
          )}
        </div>
      )}

      {/* Add type dialog */}
      <Dialog open={showAddType} onOpenChange={setShowAddType}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת סוג ציוד</DialogTitle>
            <DialogDescription>הגדר סוג ציוד חדש לקטלוג</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם בעברית</Label>
              <Input value={typeNameHe} onChange={(e) => setTypeNameHe(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>שם באנגלית</Label>
              <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={typeCategory} onValueChange={setTypeCategory}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={typeSerialReq} onCheckedChange={setTypeSerialReq} id="serial-req" />
              <Label htmlFor="serial-req">דרוש מספר סידורי</Label>
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea value={typeDesc} onChange={(e) => setTypeDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddType(false)}>ביטול</Button>
            <Button onClick={handleAddType} disabled={!typeNameHe || !typeName || !typeCategory}>
              הוסף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
