import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowRight, Trash2, Phone, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SoldierForm } from '@/components/soldiers/SoldierForm';
import { SoldierEquipmentTab } from '@/components/soldiers/SoldierEquipmentTab';
import { SoldierStatusTab } from '@/components/soldiers/SoldierStatusTab';
import { SoldierCrewTab } from '@/components/soldiers/SoldierCrewTab';
import { useSoldier, updateSoldier, deleteSoldier } from '@/hooks/useSoldiers';
import { useCurrentStatus } from '@/hooks/useStatusHistory';
import { getRankLabel, getStatusInfo, getStatusBadgeVariant } from '@/lib/constants';
import type { SoldierFormData } from '@/lib/validators';

export function SoldierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const soldier = useSoldier(id);
  const currentStatus = useCurrentStatus(id);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (!soldier) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>טוען...</p>
      </div>
    );
  }

  const statusInfo = currentStatus ? getStatusInfo(currentStatus.status) : null;

  const handleUpdate = async (data: SoldierFormData) => {
    await updateSoldier(soldier.id, data);
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteSoldier(soldier.id);
    navigate('/soldiers');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/soldiers')} aria-label="חזרה">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold">
            {getRankLabel(soldier.rank)} {soldier.firstName} {soldier.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">מ.א: {soldier.militaryId}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusInfo && (
            <Badge variant={getStatusBadgeVariant(currentStatus!.status) as any} className="text-sm">
              {statusInfo.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`tel:${soldier.phoneNumber}`}>
            <Phone className="h-4 w-4 me-1" />
            חייג
          </a>
        </Button>
        {soldier.email && (
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${soldier.email}`}>
              <Mail className="h-4 w-4 me-1" />
              אימייל
            </a>
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" dir="rtl">
        <TabsList>
          <TabsTrigger value="info">פרטים אישיים</TabsTrigger>
          <TabsTrigger value="equipment">ציוד</TabsTrigger>
          <TabsTrigger value="status">סטטוס</TabsTrigger>
          <TabsTrigger value="crew">צוות טנק</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          {editing ? (
            <Card>
              <CardContent className="pt-6">
                <SoldierForm soldier={soldier} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">פרטים אישיים</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>עריכה</Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <InfoItem label="שם פרטי" value={soldier.firstName} />
                  <InfoItem label="שם משפחה" value={soldier.lastName} />
                  <InfoItem label="דרגה" value={getRankLabel(soldier.rank)} />
                  <InfoItem label="מספר אישי" value={soldier.militaryId} />
                  <InfoItem label="טלפון" value={soldier.phoneNumber} dir="ltr" />
                  <InfoItem label="אימייל" value={soldier.email ?? '-'} dir="ltr" />
                  <InfoItem label="איש קשר חירום" value={soldier.emergencyContact} />
                  <InfoItem label="טלפון חירום" value={soldier.emergencyPhone} dir="ltr" />
                  <InfoItem label="סוג דם" value={soldier.bloodType} />
                  <InfoItem label="מידת חולצה" value={soldier.uniformSizeTop} />
                  <InfoItem label="מידת מכנסיים" value={soldier.uniformSizeBottom} />
                  <InfoItem label="מידת נעליים" value={String(soldier.shoeSize)} />
                  <InfoItem label="מידת קסדה" value={soldier.helmetSize ?? '-'} />
                </div>
                {soldier.medicalNotes && (
                  <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> הערות רפואיות
                    </p>
                    <p className="text-sm">{soldier.medicalNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="equipment">
          <SoldierEquipmentTab soldierId={soldier.id} />
        </TabsContent>

        <TabsContent value="status">
          <SoldierStatusTab soldierId={soldier.id} />
        </TabsContent>

        <TabsContent value="crew">
          <SoldierCrewTab soldierId={soldier.id} />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת חייל</DialogTitle>
            <DialogDescription>
              האם אתה בטוח שברצונך למחוק את {soldier.firstName} {soldier.lastName}?
              פעולה זו תמחק גם את כל הציוד, הסטטוסים ושיבוץ הצוות של חייל זה.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>ביטול</Button>
            <Button variant="destructive" onClick={handleDelete}>מחק</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium" dir={dir}>{value}</p>
    </div>
  );
}
