import { BrowserRouter, Routes, Route } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { SoldiersListPage } from '@/pages/SoldiersListPage';
import { SoldierProfilePage } from '@/pages/SoldierProfilePage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { ShampafPage } from '@/pages/ShampafPage';
import { AssignmentPage } from '@/pages/AssignmentPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/soldiers" element={<SoldiersListPage />} />
          <Route path="/soldiers/:id" element={<SoldierProfilePage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/shampaf" element={<ShampafPage />} />
          <Route path="/assignments" element={<AssignmentPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
