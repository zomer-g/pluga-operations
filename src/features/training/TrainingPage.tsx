import { useState, useMemo, useRef } from 'react';
import { BookOpen, Plus, Search, Trash2, Edit3, ExternalLink, FileText, Video, Presentation, Link2, Tag, FolderOpen, Upload, File as FileIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  useTrainingContent,
  useTrainingTags,
  useTrainingCategories,
  addTrainingContent,
  updateTrainingContent,
  deleteTrainingContent,
  addTrainingTag,
  deleteTrainingTag,
  addTrainingCategory,
  deleteTrainingCategory,
} from './useTraining';
import { useAuth } from '@/components/auth/AuthProvider';
import { TRAINING_CONTENT_TYPES, getTrainingContentTypeLabel } from '@/lib/constants';
import { uploadFile } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { TrainingContentType, TrainingContent as TC } from '@/db/schema';

const CONTENT_TYPE_ICONS: Record<TrainingContentType, typeof FileText> = {
  document: FileText,
  video: Video,
  presentation: Presentation,
  link: Link2,
  other: FileText,
};

export function TrainingPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<TC | null>(null);
  const [viewItem, setViewItem] = useState<TC | null>(null);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);

  const filters = useMemo(() => ({
    search: searchQuery || undefined,
    category: selectedCategory || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  }), [searchQuery, selectedCategory, selectedTags]);

  const content = useTrainingContent(filters);
  const tags = useTrainingTags();
  const categories = useTrainingCategories();

  if (content === undefined || tags === undefined || categories === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">תוכן הדרכה</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageCatsOpen(true)} className="gap-1">
            <FolderOpen className="h-3 w-3" />
            קטגוריות
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManageTagsOpen(true)} className="gap-1">
            <Tag className="h-3 w-3" />
            תגיות
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף תוכן
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>תוכן חדש</DialogTitle>
              </DialogHeader>
              <ContentForm
                categories={categories}
                tags={tags}
                onSave={async (data) => {
                  await addTrainingContent({ ...data, createdBy: user?.sub ?? '' });
                  setAddOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש לפי כותרת, תיאור, תגית..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-10"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedCategory || '__all__'} onValueChange={(v) => setSelectedCategory(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="כל הקטגוריות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל הקטגוריות</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.map(tag => (
          <Badge
            key={tag.id}
            variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
            className="cursor-pointer select-none"
            onClick={() => toggleTag(tag.name)}
          >
            {tag.name}
          </Badge>
        ))}
      </div>

      {/* Content Grid */}
      {content.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery || selectedCategory || selectedTags.length > 0
              ? 'לא נמצאו תוצאות. נסה לשנות את החיפוש.'
              : 'אין תוכן הדרכה. הוסף תוכן חדש כדי להתחיל.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.map((item) => {
            const Icon = CONTENT_TYPE_ICONS[item.contentType] || FileText;
            return (
              <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewItem(item)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-medium text-foreground line-clamp-2">{item.title}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {getTrainingContentTypeLabel(item.contentType)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map(t => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleDateString('he-IL')}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(o) => !o && setViewItem(null)}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle>{viewItem.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {viewItem.description && <p className="text-muted-foreground">{viewItem.description}</p>}
                {viewItem.contentBody && (
                  <div className="bg-card border rounded p-4 whitespace-pre-wrap text-sm text-foreground">
                    {viewItem.contentBody}
                  </div>
                )}
                {viewItem.fileUrl && (
                  <a
                    href={viewItem.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline bg-card border rounded px-3 py-2"
                  >
                    <FileIcon className="h-4 w-4" />
                    הורד קובץ מצורף
                  </a>
                )}
                {viewItem.externalUrl && (
                  <a
                    href={viewItem.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    פתח קישור
                  </a>
                )}
                {viewItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {viewItem.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditItem(viewItem); setViewItem(null); }} className="gap-1">
                    <Edit3 className="h-3 w-3" />
                    ערוך
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (confirm('למחוק תוכן זה?')) {
                        await deleteTrainingContent(viewItem.id);
                        setViewItem(null);
                      }
                    }}
                    className="gap-1 text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    מחק
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת תוכן</DialogTitle>
          </DialogHeader>
          {editItem && (
            <ContentForm
              categories={categories}
              tags={tags}
              initial={editItem}
              onSave={async (data) => {
                await updateTrainingContent(editItem.id, data);
                setEditItem(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} tags={tags} />

      {/* Manage Categories Dialog */}
      <ManageCategoriesDialog open={manageCatsOpen} onClose={() => setManageCatsOpen(false)} categories={categories} />
    </div>
  );
}

// ===== Content Form =====

function ContentForm({
  categories,
  tags,
  initial,
  onSave,
}: {
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  initial?: TC;
  onSave: (data: {
    title: string;
    description?: string;
    contentType: TrainingContentType;
    contentBody?: string;
    fileUrl?: string;
    externalUrl?: string;
    tags: string[];
    category: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [contentType, setContentType] = useState<TrainingContentType>(initial?.contentType ?? 'document');
  const [contentBody, setContentBody] = useState(initial?.contentBody ?? '');
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState(initial?.fileUrl ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (name: string) => {
    setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !category) return;
    setSaving(true);

    let fileUrl: string | undefined = existingFileUrl || undefined;

    // Upload file if selected
    if (file) {
      try {
        const fileId = generateId();
        const storagePath = `training/${fileId}/${file.name}`;
        fileUrl = await uploadFile(file, storagePath, (p) => setUploadProgress(p));
      } catch (err) {
        console.error('File upload failed:', err);
        setSaving(false);
        setUploadProgress(null);
        return;
      }
    }

    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      contentType,
      contentBody: contentBody.trim() || undefined,
      fileUrl,
      externalUrl: externalUrl.trim() || undefined,
      tags: selectedTags,
      category,
    });
    setSaving(false);
    setUploadProgress(null);
  };

  const acceptTypes = {
    document: '.pdf,.doc,.docx,.txt,.rtf,.odt',
    video: 'video/*',
    presentation: '.ppt,.pptx,.odp,.pdf',
    other: '.pdf,.doc,.docx,.txt,.rtf,.odt,.ppt,.pptx,.odp,image/*,video/mp4,video/webm',
    link: '',
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>כותרת</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label>תיאור</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div>
        <Label>סוג תוכן</Label>
        <Select value={contentType} onValueChange={(v) => setContentType(v as TrainingContentType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRAINING_CONTENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>קטגוריה</Label>
        <Select value={category || '__none__'} onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="בחר קטגוריה..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">בחר קטגוריה...</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>תגיות</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* File Upload */}
      {contentType !== 'link' && (
        <div>
          <Label>העלאת קובץ</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes[contentType] || '*'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
            className="hidden"
          />
          <div className="mt-1 space-y-2">
            {existingFileUrl && !file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded px-3 py-2">
                <FileIcon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">קובץ קיים</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExistingFileUrl('')}
                  className="text-destructive text-xs"
                >
                  הסר
                </Button>
              </div>
            )}
            {file && (
              <div className="flex items-center gap-2 text-sm text-foreground bg-card border rounded px-3 py-2">
                <FileIcon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-destructive text-xs"
                >
                  הסר
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-3 w-3" />
              {file ? 'החלף קובץ' : 'בחר קובץ'}
            </Button>
          </div>
          {uploadProgress !== null && (
            <div className="mt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{uploadProgress}% הועלה</p>
            </div>
          )}
        </div>
      )}

      {(contentType === 'link' || contentType === 'video') && (
        <div>
          <Label>קישור URL</Label>
          <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} dir="ltr" />
        </div>
      )}
      <div>
        <Label>תוכן (טקסט)</Label>
        <Textarea value={contentBody} onChange={(e) => setContentBody(e.target.value)} rows={5} />
      </div>
      <Button onClick={handleSubmit} disabled={saving || !title.trim() || !category}>
        {saving ? (uploadProgress !== null ? `מעלה... ${uploadProgress}%` : 'שומר...') : 'שמור'}
      </Button>
    </div>
  );
}

// ===== Manage Tags Dialog =====

function ManageTagsDialog({ open, onClose, tags }: { open: boolean; onClose: () => void; tags: { id: string; name: string }[] }) {
  const [newTag, setNewTag] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול תגיות</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="תגית חדשה..." className="flex-1" />
            <Button onClick={async () => { if (newTag.trim()) { await addTrainingTag(newTag.trim()); setNewTag(''); } }} disabled={!newTag.trim()}>
              הוסף
            </Button>
          </div>
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-foreground">{tag.name}</span>
                <Button variant="ghost" size="icon" onClick={() => deleteTrainingTag(tag.id)} aria-label="מחק תגית">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== Manage Categories Dialog =====

function ManageCategoriesDialog({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: { id: string; name: string; order: number }[] }) {
  const [newCat, setNewCat] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול קטגוריות</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="קטגוריה חדשה..." className="flex-1" />
            <Button onClick={async () => { if (newCat.trim()) { await addTrainingCategory(newCat.trim(), categories.length); setNewCat(''); } }} disabled={!newCat.trim()}>
              הוסף
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-foreground">{cat.name}</span>
                <Button variant="ghost" size="icon" onClick={() => deleteTrainingCategory(cat.id)} aria-label="מחק קטגוריה">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
