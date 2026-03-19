import { useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSoldierCrewAssignment, useTank } from '@/hooks/useTanks';
import { getCrewRoleLabel } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

interface Props {
  soldierId: string;
}

export function SoldierCrewTab({ soldierId }: Props) {
  const navigate = useNavigate();
  const assignment = useSoldierCrewAssignment(soldierId);
  const tank = useTank(assignment?.tankId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">שיבוץ צוות טנק</CardTitle>
      </CardHeader>
      <CardContent>
        {assignment && tank ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-bold text-lg">{tank.designation}</p>
                  <p className="text-sm text-muted-foreground">{tank.type}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">תפקיד</p>
                  <p className="font-medium">{getCrewRoleLabel(assignment.role)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">משובץ מ</p>
                  <p className="font-medium">{formatDate(assignment.startDate)}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/tanks')}>
              צפה בטנקים
            </Button>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>לא משובץ לצוות טנק כרגע</p>
            <p className="text-xs mt-1">ניתן לשבץ מעמוד הטנקים</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate('/tanks')}>
              עבור לטנקים
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
