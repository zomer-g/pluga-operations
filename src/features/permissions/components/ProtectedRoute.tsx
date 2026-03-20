import type { ReactNode } from 'react';
import { useCanAccessPage } from '../usePermissions';
import { AccessDenied } from './AccessDenied';

interface ProtectedRouteProps {
  route: string;
  children: ReactNode;
}

export function ProtectedRoute({ route, children }: ProtectedRouteProps) {
  const canAccess = useCanAccessPage(route);

  // Still loading permissions
  if (canAccess === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
