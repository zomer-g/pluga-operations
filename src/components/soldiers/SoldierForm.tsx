import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { soldierSchema, type SoldierFormData } from '@/lib/validators';
import { RANKS, BLOOD_TYPES, CLOTHING_SIZES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlatoons } from '@/hooks/useTanks';
import type { Soldier } from '@/db/schema';

interface SoldierFormProps {
  soldier?: Soldier;
  onSubmit: (data: SoldierFormData) => Promise<void>;
  onCancel: () => void;
}

export function SoldierForm({ soldier, onSubmit, onCancel }: SoldierFormProps) {
  const platoons = usePlatoons();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SoldierFormData>({
    resolver: zodResolver(soldierSchema),
    defaultValues: soldier
      ? {
          militaryId: soldier.militaryId,
          firstName: soldier.firstName,
          lastName: soldier.lastName,
          rank: soldier.rank,
          phoneNumber: soldier.phoneNumber,
          emergencyContact: soldier.emergencyContact,
          emergencyPhone: soldier.emergencyPhone,
          email: soldier.email ?? '',
          bloodType: soldier.bloodType,
          medicalNotes: soldier.medicalNotes ?? '',
          uniformSizeTop: soldier.uniformSizeTop,
          uniformSizeBottom: soldier.uniformSizeBottom,
          shoeSize: soldier.shoeSize,
          helmetSize: soldier.helmetSize ?? '',
          platoonId: soldier.platoonId ?? '',
        }
      : {
          rank: '',
          bloodType: '',
          uniformSizeTop: '',
          uniformSizeBottom: '',
          shoeSize: 42,
        },
  });

  const currentRank = watch('rank');
  const currentBlood = watch('bloodType');
  const currentSizeTop = watch('uniformSizeTop');
  const currentSizeBottom = watch('uniformSizeBottom');
  const currentPlatoon = watch('platoonId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal Info */}
      <div>
        <h3 className="text-base font-semibold mb-3">פרטים אישיים</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="militaryId">מספר אישי</Label>
            <Input id="militaryId" {...register('militaryId')} placeholder="1234567" />
            {errors.militaryId && <p className="text-xs text-destructive">{errors.militaryId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rank">דרגה</Label>
            <Select value={currentRank} onValueChange={(v) => setValue('rank', v)}>
              <SelectTrigger><SelectValue placeholder="בחר דרגה" /></SelectTrigger>
              <SelectContent>
                {RANKS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.rank && <p className="text-xs text-destructive">{errors.rank.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName">שם פרטי</Label>
            <Input id="firstName" {...register('firstName')} />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">שם משפחה</Label>
            <Input id="lastName" {...register('lastName')} />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-base font-semibold mb-3">פרטי קשר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">טלפון</Label>
            <Input id="phoneNumber" type="tel" dir="ltr" {...register('phoneNumber')} placeholder="0501234567" />
            {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">אימייל</Label>
            <Input id="email" type="email" dir="ltr" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">איש קשר חירום</Label>
            <Input id="emergencyContact" {...register('emergencyContact')} />
            {errors.emergencyContact && <p className="text-xs text-destructive">{errors.emergencyContact.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyPhone">טלפון חירום</Label>
            <Input id="emergencyPhone" type="tel" dir="ltr" {...register('emergencyPhone')} placeholder="0501234567" />
            {errors.emergencyPhone && <p className="text-xs text-destructive">{errors.emergencyPhone.message}</p>}
          </div>
        </div>
      </div>

      {/* Medical & Measurements */}
      <div>
        <h3 className="text-base font-semibold mb-3">מידות ורפואי</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>סוג דם</Label>
            <Select value={currentBlood} onValueChange={(v) => setValue('bloodType', v)}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((bt) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bloodType && <p className="text-xs text-destructive">{errors.bloodType.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>מידת חולצה</Label>
            <Select value={currentSizeTop} onValueChange={(v) => setValue('uniformSizeTop', v)}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>
                {CLOTHING_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.uniformSizeTop && <p className="text-xs text-destructive">{errors.uniformSizeTop.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>מידת מכנסיים</Label>
            <Select value={currentSizeBottom} onValueChange={(v) => setValue('uniformSizeBottom', v)}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>
                {CLOTHING_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.uniformSizeBottom && <p className="text-xs text-destructive">{errors.uniformSizeBottom.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shoeSize">מידת נעליים</Label>
            <Input id="shoeSize" type="number" {...register('shoeSize')} />
            {errors.shoeSize && <p className="text-xs text-destructive">{errors.shoeSize.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="helmetSize">מידת קסדה</Label>
            <Input id="helmetSize" {...register('helmetSize')} placeholder="M / L" />
          </div>
          <div className="space-y-2">
            <Label>מחלקה</Label>
            <Select value={currentPlatoon || '__none__'} onValueChange={(v) => setValue('platoonId', v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="בחר מחלקה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא</SelectItem>
                {platoons?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="medicalNotes">הערות רפואיות</Label>
          <Textarea id="medicalNotes" {...register('medicalNotes')} rows={2} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>ביטול</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'שומר...' : soldier ? 'עדכון' : 'הוספה'}
        </Button>
      </div>
    </form>
  );
}
