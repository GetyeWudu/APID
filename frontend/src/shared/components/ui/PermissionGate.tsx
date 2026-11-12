import type { ReactNode } from 'react';
import { useAuth } from '../../../app/AuthContext';

export function PermissionGate({
  permission,
  anyPermissions,
  fallback = null,
  children,
}: {
  permission?: string;
  anyPermissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }
  if (anyPermissions && anyPermissions.length > 0 && !hasAnyPermission(anyPermissions)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

