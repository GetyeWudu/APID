import { useState } from 'react';
import { useAuth } from '../../../app/AuthContext';
import { AuditLogsPanel } from '../audit/components/AuditLogsPanel';
import { RolesPanel } from '../roles/components/RolesPanel';
import { UsersPanel } from '../users/components/UsersPanel';

type AdminTab = 'users' | 'roles' | 'audit';

export function AdminDashboardPage() {
  const { hasPermission } = useAuth();

  const canUsers = hasPermission('USER_MANAGE');
  const canRoles = hasPermission('ROLE_PERMISSION_MANAGE');
  const canAudit = hasPermission('AUDIT_LOG_VIEW');

  const initialTab: AdminTab = canUsers ? 'users' : canRoles ? 'roles' : 'audit';
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  return (
    <div>
      <div className="apid-card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>System Administration</h2>
        <div className="apid-tabs">
          {canUsers && (
            <button
              type="button"
              className={`apid-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
          )}
          {canRoles && (
            <button
              type="button"
              className={`apid-tab ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              Roles &amp; Permissions
            </button>
          )}
          {canAudit && (
            <button
              type="button"
              className={`apid-tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              Audit Logs
            </button>
          )}
        </div>
      </div>

      {activeTab === 'users' && canUsers && <UsersPanel />}
      {activeTab === 'roles' && canRoles && <RolesPanel />}
      {activeTab === 'audit' && canAudit && <AuditLogsPanel />}
    </div>
  );
}

