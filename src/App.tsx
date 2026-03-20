import { BrowserRouter, Routes, Route } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/features/permissions/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { SoldiersListPage } from '@/pages/SoldiersListPage';
import { SoldierProfilePage } from '@/pages/SoldierProfilePage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { ShampafPage } from '@/pages/ShampafPage';
import { AssignmentPage } from '@/pages/AssignmentPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { RoutinePage } from '@/features/routine/RoutinePage';
import { OfficerTasksPage } from '@/features/officer-tasks/OfficerTasksPage';
import { TrainingPage } from '@/features/training/TrainingPage';
import { DonationsPage } from '@/features/donations/DonationsPage';
import { PermissionsPage } from '@/features/permissions/PermissionsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<ProtectedRoute route="/"><DashboardPage /></ProtectedRoute>} />
          <Route path="/soldiers" element={<ProtectedRoute route="/soldiers"><SoldiersListPage /></ProtectedRoute>} />
          <Route path="/soldiers/:id" element={<ProtectedRoute route="/soldiers"><SoldierProfilePage /></ProtectedRoute>} />
          <Route path="/equipment" element={<ProtectedRoute route="/equipment"><EquipmentPage /></ProtectedRoute>} />
          <Route path="/shampaf" element={<ProtectedRoute route="/shampaf"><ShampafPage /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute route="/assignments"><AssignmentPage /></ProtectedRoute>} />
          <Route path="/routine" element={<ProtectedRoute route="/routine"><RoutinePage /></ProtectedRoute>} />
          <Route path="/officer-tasks" element={<ProtectedRoute route="/officer-tasks"><OfficerTasksPage /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute route="/training"><TrainingPage /></ProtectedRoute>} />
          <Route path="/donations" element={<ProtectedRoute route="/donations"><DonationsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute route="/reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute route="/settings"><SettingsPage /></ProtectedRoute>} />
          <Route path="/permissions" element={<ProtectedRoute route="/permissions"><PermissionsPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
