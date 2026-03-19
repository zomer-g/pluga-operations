import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSoldiers } from '@/hooks/useSoldiers';
import { useEquipmentTypes, useActiveAssignments } from '@/hooks/useEquipment';
import { useAllCurrentStatuses } from '@/hooks/useStatusHistory';
import { useTanks, useAllCrewAssignments } from '@/hooks/useTanks';
import { getRankLabel, getStatusInfo, getConditionLabel, getTankStatusLabel } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export function ReportsPage() {
  const soldiers = useSoldiers();
  const equipmentTypes = useEquipmentTypes();
  const activeAssignments = useActiveAssignments();
  const currentStatuses = useAllCurrentStatuses();
  const tanks = useTanks();
  const crewAssignments = useAllCrewAssignments();

  const [exporting, setExporting] = useState('');

  const exportSoldiersCSV = () => {
    if (!soldiers) return;
    setExporting('soldiers');

    const headers = ['מספר אישי', 'דרגה', 'שם פרטי', 'שם משפחה', 'טלפון', 'אימייל', 'סוג דם', 'חולצה', 'מכנסיים', 'נעליים', 'סטטוס'];
    const rows = soldiers.map((s) => {
      const status = currentStatuses?.get(s.id);
      return [
        s.militaryId,
        getRankLabel(s.rank),
        s.firstName,
        s.lastName,
        s.phoneNumber,
        s.email ?? '',
        s.bloodType,
        s.uniformSizeTop,
        s.uniformSizeBottom,
        String(s.shoeSize),
        status ? getStatusInfo(status.status).label : '',
      ];
    });

    downloadCSV('חיילים', headers, rows);
    setExporting('');
  };

  const exportEquipmentCSV = () => {
    if (!activeAssignments || !soldiers || !equipmentTypes) return;
    setExporting('equipment');

    const headers = ['סוג ציוד', 'מספר סידורי', 'חייל', 'תאריך חתימה', 'מצב'];
    const rows = activeAssignments.map((a) => {
      const soldier = soldiers.find((s) => s.id === a.soldierId);
      const eqType = equipmentTypes.find((t) => t.id === a.equipmentTypeId);
      return [
        eqType?.nameHe ?? '',
        a.serialNumber ?? '',
        soldier ? `${soldier.firstName} ${soldier.lastName}` : '',
        formatDate(a.signedOutDate),
        getConditionLabel(a.condition),
      ];
    });

    downloadCSV('ציוד_חתום', headers, rows);
    setExporting('');
  };

  const exportTanksCSV = () => {
    if (!tanks || !soldiers) return;
    setExporting('tanks');

    const headers = ['כינוי', 'סוג', 'סטטוס', 'מפקד', 'תותחן', 'נהג', 'טען'];
    const rows = tanks.map((t) => {
      const crew = crewAssignments?.filter((c) => c.tankId === t.id) ?? [];
      const getName = (role: string) => {
        const member = crew.find((c) => c.role === role);
        if (!member) return '';
        const s = soldiers.find((s) => s.id === member.soldierId);
        return s ? `${s.firstName} ${s.lastName}` : '';
      };
      return [
        t.designation,
        t.type,
        getTankStatusLabel(t.status),
        getName('commander'),
        getName('gunner'),
        getName('driver'),
        getName('loader'),
      ];
    });

    downloadCSV('טנקים', headers, rows);
    setExporting('');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">דוחות</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              רשימת חיילים
            </CardTitle>
            <CardDescription>ייצוא כל החיילים עם פרטים אישיים ומידות</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={exportSoldiersCSV}
              disabled={exporting === 'soldiers'}
              className="w-full"
            >
              <Download className="h-4 w-4 me-2" />
              {exporting === 'soldiers' ? 'מייצא...' : 'ייצוא CSV'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              ציוד חתום
            </CardTitle>
            <CardDescription>ייצוא כל הציוד החתום כרגע</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={exportEquipmentCSV}
              disabled={exporting === 'equipment'}
              className="w-full"
            >
              <Download className="h-4 w-4 me-2" />
              {exporting === 'equipment' ? 'מייצא...' : 'ייצוא CSV'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              שיבוץ טנקים
            </CardTitle>
            <CardDescription>ייצוא טנקים עם צוותות</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={exportTanksCSV}
              disabled={exporting === 'tanks'}
              className="w-full"
            >
              <Download className="h-4 w-4 me-2" />
              {exporting === 'tanks' ? 'מייצא...' : 'ייצוא CSV'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function downloadCSV(name: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF';
  const csv = BOM + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
