import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col md:flex-row overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-e bg-card">
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <Header />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t bg-card safe-bottom">
          <MobileNav />
        </nav>
      </div>
    </div>
  );
}
