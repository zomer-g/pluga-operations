import { useState, useRef } from 'react';
import { Download, Upload, Plus, Trash2, Moon, Sun, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAppStore } from '@/stores/useAppStore';
import { exportData, importData, downloadBackup } from '@/db/backup';
import { usePlatoons, addPlatoon, deletePlatoon } from '@/hooks/useTanks';

export function SettingsPage() {
  const { theme, toggleTheme } = useAppStore();
  const platoons = usePlatoons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddPlatoon, setShowAddPlatoon] = useState(false);
  const [platoonName, setPlatoonName] = useState('');
  const [platoonNumber, setPlatoonNumber] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = async () => {
    const json = await exportData();
    downloadBackup(json);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = await importData(text);
    setImportStatus({ type: result.success ? 'success' : 'error', message: result.message });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddPlatoon = async () => {
    if (platoonName && platoonNumber) {
      await addPlatoon(platoonName, parseInt(platoonNumber));
      setShowAddPlatoon(false);
      setPlatoonName('');
      setPlatoonNumber('');
    }
  };

  const handleClearData = async () => {
    const { db } = await import('@/db/database');
    await db.delete();
    setShowClearConfirm(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">הגדרות</h2>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">מראה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span>{theme === 'dark' ? 'מצב כהה' : 'מצב בהיר'}</span>
            </div>
            <Button variant="outline" onClick={toggleTheme}>
              {theme === 'dark' ? 'עבור לבהיר' : 'עבור לכהה'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platoons */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">מחלקות</CardTitle>
            <CardDescription>ניהול מחלקות הפלוגה</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddPlatoon(true)}>
            <Plus className="h-4 w-4 me-1" />
            הוסף
          </Button>
        </CardHeader>
        <CardContent>
          {platoons && platoons.length > 0 ? (
            <div className="space-y-2">
              {platoons.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium">{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={() => deletePlatoon(p.id)}
                    aria-label={`מחק ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">אין מחלקות מוגדרות</p>
          )}
        </CardContent>
      </Card>

      {/* Data backup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            גיבוי ושחזור
          </CardTitle>
          <CardDescription>ייצוא וייבוא של כל הנתונים כקובץ JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={handleExport} className="flex-1">
              <Download className="h-4 w-4 me-2" />
              ייצוא נתונים
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 me-2" />
              ייבוא נתונים
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {importStatus && (
            <div
              className={`p-3 rounded-lg text-sm ${
                importStatus.type === 'success'
                  ? 'bg-status-active/10 text-status-active'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {importStatus.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">אזור מסוכן</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowClearConfirm(true)}>
            <Trash2 className="h-4 w-4 me-2" />
            מחק את כל הנתונים
          </Button>
        </CardContent>
      </Card>

      {/* Add platoon dialog */}
      <Dialog open={showAddPlatoon} onOpenChange={setShowAddPlatoon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת מחלקה</DialogTitle>
            <DialogDescription>הגדר מחלקה חדשה בפלוגה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם מחלקה</Label>
              <Input value={platoonName} onChange={(e) => setPlatoonName(e.target.value)} placeholder='למשל: "מחלקה 4"' />
            </div>
            <div className="space-y-2">
              <Label>מספר</Label>
              <Input type="number" value={platoonNumber} onChange={(e) => setPlatoonNumber(e.target.value)} placeholder="4" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlatoon(false)}>ביטול</Button>
            <Button onClick={handleAddPlatoon} disabled={!platoonName || !platoonNumber}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear data confirmation */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת כל הנתונים</DialogTitle>
            <DialogDescription>
              האם אתה בטוח? פעולה זו תמחק את כל הנתונים ולא ניתן לשחזר אותם.
              מומלץ לייצא גיבוי לפני כן.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>ביטול</Button>
            <Button variant="destructive" onClick={handleClearData}>מחק הכל</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
