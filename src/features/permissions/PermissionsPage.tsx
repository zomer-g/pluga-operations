import { useState } from 'react';
import { Shield, Plus, Trash2, Save, Users, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import {
  usePermissionGroups,
  useUserPermissions,
  addPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
  setUserPermission,
} from './usePermissions';
import { ALL_PAGE_ROUTES, PERMISSION_ACTIONS } from '@/lib/constants';
import type { PermissionGroup, PermissionAction } from '@/db/schema';

export function PermissionsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">ניהול הרשאות</h1>
      </div>

      <Tabs defaultValue="groups" dir="rtl">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="groups" className="flex-1 gap-2">
            <Layers className="h-4 w-4" />
            קבוצות
          </TabsTrigger>
          <TabsTrigger value="users" className="flex-1 gap-2">
            <Users className="h-4 w-4" />
            משתמשים
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Groups Tab =====

function GroupsTab() {
  const groups = usePermissionGroups();
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  if (!groups) {
    return <div className="text-center py-8 text-muted-foreground">טוען...</div>;
  }

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const pagePerms: Record<string, PermissionAction> = {};
    ALL_PAGE_ROUTES.forEach(p => {
      if (p.route !== '/permissions' && p.route !== '/settings') {
        pagePerms[p.route] = 'view';
      }
    });
    await addPermissionGroup({
      name: newGroupName.trim(),
      isDefault: false,
      pagePermissions: pagePerms,
    });
    setNewGroupName('');
    setAddOpen(false);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('למחוק קבוצה זו?')) return;
    await deletePermissionGroup(id);
  };

  const handleSetDefault = async (id: string) => {
    // Unset all defaults, set this one
    for (const g of groups) {
      if (g.isDefault && g.id !== id) {
        await updatePermissionGroup(g.id, { isDefault: false });
      }
    }
    await updatePermissionGroup(id, { isDefault: true });
  };

  return (
    <div className="space-y-4 mt-4">
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            הוסף קבוצה
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>קבוצה חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם הקבוצה</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="למשל: מפקדים"
              />
            </div>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              צור קבוצה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingGroup ? (
        <GroupEditor
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
        />
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">{group.name}</span>
                  {group.isDefault && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                      ברירת מחדל
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!group.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(group.id)}
                      className="text-xs"
                    >
                      הגדר כברירת מחדל
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingGroup(group)}
                  >
                    ערוך הרשאות
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGroup(group.id)}
                    aria-label="מחק קבוצה"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Group Editor =====

function GroupEditor({ group, onClose }: { group: PermissionGroup; onClose: () => void }) {
  const [perms, setPerms] = useState<Record<string, PermissionAction>>(
    { ...group.pagePermissions }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updatePermissionGroup(group.id, { pagePermissions: perms });
    setSaving(false);
    onClose();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>עריכת הרשאות: {group.name}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              ביטול
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              שמור
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2 pe-4 font-medium text-foreground">דף</th>
                <th className="text-center py-2 px-2 font-medium text-foreground">ללא גישה</th>
                {PERMISSION_ACTIONS.map(a => (
                  <th key={a.value} className="text-center py-2 px-2 font-medium text-foreground">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PAGE_ROUTES.map(page => (
                <tr key={page.route} className="border-b border-border/50">
                  <td className="py-2 pe-4 text-foreground">{page.label}</td>
                  <td className="text-center py-2 px-2">
                    <input
                      type="radio"
                      name={`perm-${page.route}`}
                      checked={!perms[page.route]}
                      onChange={() => {
                        const next = { ...perms };
                        delete next[page.route];
                        setPerms(next);
                      }}
                      className="accent-primary h-4 w-4"
                    />
                  </td>
                  {PERMISSION_ACTIONS.map(a => (
                    <td key={a.value} className="text-center py-2 px-2">
                      <input
                        type="radio"
                        name={`perm-${page.route}`}
                        checked={perms[page.route] === a.value}
                        onChange={() => setPerms({ ...perms, [page.route]: a.value })}
                        className="accent-primary h-4 w-4"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Users Tab =====

function UsersTab() {
  const users = useUserPermissions();
  const groups = usePermissionGroups();

  if (!users || !groups) {
    return <div className="text-center py-8 text-muted-foreground">טוען...</div>;
  }

  const handleChangeGroup = async (userId: string, groupId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    await setUserPermission(userId, {
      email: user.email,
      displayName: user.displayName,
      groupId,
    });
  };

  return (
    <div className="mt-4">
      {users.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">אין משתמשים רשומים</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-3 pe-4 font-medium text-foreground">שם</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground">אימייל</th>
                <th className="text-right py-3 pe-4 font-medium text-foreground w-48">קבוצה</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-border/50">
                  <td className="py-3 pe-4 text-foreground">{user.displayName}</td>
                  <td className="py-3 pe-4 text-muted-foreground">{user.email}</td>
                  <td className="py-3 pe-4">
                    <Select
                      value={user.groupId}
                      onValueChange={(val) => handleChangeGroup(user.id, val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
