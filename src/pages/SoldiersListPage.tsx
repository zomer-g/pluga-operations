import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SoldierForm } from '@/components/soldiers/SoldierForm';
import { useSoldiers, addSoldier } from '@/hooks/useSoldiers';
import { useAllCurrentStatuses } from '@/hooks/useStatusHistory';
import { usePlatoons } from '@/hooks/useTanks';
import { getRankLabel, getStatusInfo, getStatusBadgeVariant, RANKS } from '@/lib/constants';
import type { SoldierFormData } from '@/lib/validators';
import type { SoldierRank } from '@/db/schema';

export function SoldiersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState<string>('');
  const [platoonFilter, setPlatoonFilter] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);

  const soldiers = useSoldiers({
    search,
    rank: (rankFilter || undefined) as SoldierRank | undefined,
    platoonId: platoonFilter || undefined,
  });
  const currentStatuses = useAllCurrentStatuses();
  const platoons = usePlatoons();

  const handleAdd = async (data: SoldierFormData) => {
    const id = await addSoldier(data);
    setShowAdd(false);
    navigate(`/soldiers/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">חיילים</h2>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 me-1" />
          הוספת חייל
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, מ.א, טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10"
          />
        </div>
        <Select value={rankFilter || '__all__'} onValueChange={(v) => setRankFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="דרגה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">הכל</SelectItem>
            {RANKS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platoonFilter || '__all__'} onValueChange={(v) => setPlatoonFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="מחלקה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">הכל</SelectItem>
            {platoons?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {soldiers && soldiers.length > 0 ? (
        <div className="grid gap-3">
          {soldiers.map((soldier) => {
            const status = currentStatuses?.get(soldier.id);
            const statusInfo = status ? getStatusInfo(status.status) : null;
            return (
              <Card
                key={soldier.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/soldiers/${soldier.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {soldier.firstName[0]}{soldier.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {getRankLabel(soldier.rank)} {soldier.firstName} {soldier.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          מ.א: {soldier.militaryId} | {soldier.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusInfo && (
                        <Badge variant={getStatusBadgeVariant(status!.status) as any}>{statusInfo.label}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">
            {search || rankFilter || platoonFilter ? 'לא נמצאו תוצאות' : 'אין חיילים עדיין'}
          </p>
          <p className="text-sm mt-1">
            {search || rankFilter || platoonFilter
              ? 'נסה לשנות את החיפוש או הסינון'
              : 'לחץ על "הוספת חייל" כדי להתחיל'}
          </p>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>הוספת חייל חדש</DialogTitle>
            <DialogDescription>הזן את פרטי החייל</DialogDescription>
          </DialogHeader>
          <SoldierForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
