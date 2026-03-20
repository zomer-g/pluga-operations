import { useState } from 'react';
import { Heart, Plus, Trash2, Edit3, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  useDonations,
  useDonationStats,
  addDonation,
  updateDonation,
  deleteDonation,
} from './useDonations';
import { DONATION_TYPES, getDonationTypeLabel } from '@/lib/constants';
import { todayString } from '@/lib/utils';
import type { Donation, DonationType } from '@/db/schema';

export function DonationsPage() {
  const [typeFilter, setTypeFilter] = useState<DonationType | ''>('');
  const donations = useDonations(typeFilter ? { type: typeFilter as DonationType } : undefined);
  const stats = useDonationStats(donations);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Donation | null>(null);

  if (donations === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">ניהול תרומות</h1>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              תרומה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>תרומה חדשה</DialogTitle>
            </DialogHeader>
            <DonationForm onSave={async (data) => { await addDonation(data); setAddOpen(false); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="סה&quot;כ כספי" value={`${stats.totalMonetary.toLocaleString()} \u20AA`} />
          <StatCard icon={Package} label="תרומות ציוד" value={String(stats.countByType['equipment'] ?? 0)} />
          <StatCard icon={ShoppingBag} label="תרומות אספקה" value={String(stats.countByType['supplies'] ?? 0)} />
          <StatCard icon={Users} label="תורמים" value={String(stats.uniqueDonors)} />
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v as DonationType)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="כל הסוגים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל הסוגים</SelectItem>
            {DONATION_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{donations.length} תרומות</span>
      </div>

      {/* Table */}
      {donations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין תרומות. הוסף תרומה חדשה כדי להתחיל.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-3 pe-4 font-medium text-foreground">תורם</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground">סוג</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground">תיאור</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground">סכום</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground">תאריך</th>
                <th className="text-center py-3 font-medium text-foreground w-20">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-card/50">
                  <td className="py-3 pe-4 text-foreground font-medium">{d.donorName}</td>
                  <td className="py-3 pe-4 text-muted-foreground">{getDonationTypeLabel(d.type)}</td>
                  <td className="py-3 pe-4 text-muted-foreground max-w-[200px] truncate">{d.description}</td>
                  <td className="py-3 pe-4 text-foreground">
                    {d.type === 'monetary' && d.amount ? `${d.amount.toLocaleString()} \u20AA` : '-'}
                  </td>
                  <td className="py-3 pe-4 text-muted-foreground">
                    {new Date(d.date).toLocaleDateString('he-IL')}
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditItem(d)} aria-label="ערוך">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => { if (confirm('למחוק תרומה זו?')) await deleteDonation(d.id); }}
                        aria-label="מחק"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת תרומה</DialogTitle>
          </DialogHeader>
          {editItem && (
            <DonationForm
              initial={editItem}
              onSave={async (data) => { await updateDonation(editItem.id, data); setEditItem(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Stat Card =====

function StatCard({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Donation Form =====

function DonationForm({
  initial,
  onSave,
}: {
  initial?: Donation;
  onSave: (data: Omit<Donation, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const [donorName, setDonorName] = useState(initial?.donorName ?? '');
  const [donorContact, setDonorContact] = useState(initial?.donorContact ?? '');
  const [donorPhone, setDonorPhone] = useState(initial?.donorPhone ?? '');
  const [donorEmail, setDonorEmail] = useState(initial?.donorEmail ?? '');
  const [type, setType] = useState<DonationType>(initial?.type ?? 'monetary');
  const [amount, setAmount] = useState<number | undefined>(initial?.amount);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [itemsList, setItemsList] = useState(initial?.itemsList ?? '');
  const [date, setDate] = useState(initial?.date ?? todayString());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!donorName.trim() || !description.trim()) return;
    setSaving(true);
    await onSave({
      donorName: donorName.trim(),
      donorContact: donorContact.trim() || undefined,
      donorPhone: donorPhone.trim() || undefined,
      donorEmail: donorEmail.trim() || undefined,
      type,
      amount: type === 'monetary' ? amount : undefined,
      description: description.trim(),
      itemsList: type !== 'monetary' ? itemsList.trim() || undefined : undefined,
      date,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>שם התורם</Label>
        <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>טלפון</Label>
          <Input value={donorPhone} onChange={(e) => setDonorPhone(e.target.value)} />
        </div>
        <div>
          <Label>אימייל</Label>
          <Input value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} dir="ltr" />
        </div>
      </div>
      <div>
        <Label>איש קשר</Label>
        <Input value={donorContact} onChange={(e) => setDonorContact(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>סוג תרומה</Label>
          <Select value={type} onValueChange={(v) => setType(v as DonationType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DONATION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>תאריך</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {type === 'monetary' && (
        <div>
          <Label>סכום (\u20AA)</Label>
          <Input type="number" value={amount ?? ''} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      )}
      <div>
        <Label>תיאור</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      {type !== 'monetary' && (
        <div>
          <Label>רשימת פריטים</Label>
          <Textarea value={itemsList} onChange={(e) => setItemsList(e.target.value)} rows={2} />
        </div>
      )}
      <div>
        <Label>הערות</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={handleSubmit} disabled={saving || !donorName.trim() || !description.trim()}>
        {saving ? 'שומר...' : 'שמור'}
      </Button>
    </div>
  );
}
