import { useState } from 'react';
import { Copy, Check, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAppStore } from '@/stores/useAppStore';
import { todayString } from '@/lib/utils';

interface ReportField {
  key: string;
  label: string;
}

interface ReportSectionProps {
  title: string;
  reportType: string;
  fields: ReportField[];
  onGenerate: (date: string, prefs: Record<string, boolean>) => string;
}

export function ReportSection({ title, reportType, fields, onGenerate }: ReportSectionProps) {
  const [date, setDate] = useState(todayString());
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useAppStore();
  const reportPrefs: Record<string, boolean> = (store.reportPrefs && typeof store.reportPrefs === 'object' && store.reportPrefs[reportType]) || {};

  const handleCopy = async () => {
    try {
      setError(null);
      const text = onGenerate(date, reportPrefs);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהפקת הדוח');
    }
  };

  const handleToggleField = (field: string, checked: boolean) => {
    try {
      store.setReportFieldVisibility(reportType, field, checked);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium shrink-0">{title}</span>

        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-36 h-9 text-sm"
        />

        <Button
          size="sm"
          variant={copied ? 'default' : 'outline'}
          onClick={handleCopy}
          className="h-9"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 ml-1" />
              {'הועתק'}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 ml-1" />
              {'העתק'}
            </>
          )}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowSettings(true)}
          className="h-9 w-9"
          title="הגדרות דוח"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      {showSettings && (
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{'הגדרות ' + title}</DialogTitle>
              <DialogDescription>{'בחר אילו שדות יופיעו בדוח'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center justify-between">
                  <Label htmlFor={'report-' + reportType + '-' + field.key} className="cursor-pointer">
                    {field.label}
                  </Label>
                  <Switch
                    id={'report-' + reportType + '-' + field.key}
                    checked={reportPrefs[field.key] !== false}
                    onCheckedChange={(checked: boolean) => handleToggleField(field.key, checked)}
                  />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
