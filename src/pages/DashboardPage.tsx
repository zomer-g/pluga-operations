import { useNavigate } from 'react-router';
import { Users, Package, ShieldCheck, UserCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSoldierCount, useSoldiers } from '@/hooks/useSoldiers';
import { useActiveAssignmentCount } from '@/hooks/useEquipment';
import { useTankCount } from '@/hooks/useTanks';
import { useStatusCounts, useAllCurrentStatuses } from '@/hooks/useStatusHistory';
import { getRankLabel, getStatusInfo, getStatusBadgeVariant, SOLDIER_STATUSES } from '@/lib/constants';

export function DashboardPage() {
  const navigate = useNavigate();
  const soldierCount = useSoldierCount();
  const activeEquipment = useActiveAssignmentCount();
  const tankStats = useTankCount();
  const statusCounts = useStatusCounts();
  const soldiers = useSoldiers();
  const currentStatuses = useAllCurrentStatuses();

  const recentSoldiers = soldiers?.slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">לוח בקרה</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/soldiers')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{soldierCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">חיילים</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/equipment')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/10 p-2.5">
                <Package className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeEquipment ?? 0}</p>
                <p className="text-xs text-muted-foreground">פריטי ציוד חתומים</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/assignments')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary/10 p-2.5">
                <ShieldCheck className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tankStats?.operational ?? 0}/{tankStats?.total ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">טנקים כשירים</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/shampaf')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-status-active/10 p-2.5">
                <UserCheck className="h-5 w-5 text-status-active" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts?.['active'] ?? 0}</p>
                <p className="text-xs text-muted-foreground">בשירות פעיל</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            פילוח סטטוסים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusCounts && Object.keys(statusCounts).length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {SOLDIER_STATUSES.map((s) => {
                const count = statusCounts[s.value] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={s.value} className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(s.value) as any}>{s.label}</Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">אין נתוני סטטוס עדיין</p>
          )}
        </CardContent>
      </Card>

      {/* Recent soldiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            חיילים אחרונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSoldiers && recentSoldiers.length > 0 ? (
            <div className="space-y-3">
              {recentSoldiers.map((soldier) => {
                const status = currentStatuses?.get(soldier.id);
                const statusInfo = status ? getStatusInfo(status.status) : null;
                return (
                  <div
                    key={soldier.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-card/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/soldiers/${soldier.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                        {soldier.firstName[0]}{soldier.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {soldier.rank ? getRankLabel(soldier.rank) : ''}{' '}
                          {soldier.firstName} {soldier.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          מ.א: {soldier.militaryId}
                        </p>
                      </div>
                    </div>
                    {statusInfo && (
                      <Badge variant={getStatusBadgeVariant(status!.status) as any}>
                        {statusInfo.label}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>לא נוספו חיילים עדיין</p>
              <p className="text-xs mt-1">עבור לעמוד חיילים כדי להוסיף את הראשון</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
