import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { ConfirmDialog, useToast } from '../../../../shared/components/ui';
import { rolesApi } from '../../roles/api/rolesApi';
import type { RoleItem } from '../../roles/types/roles.types';
import { usersApi } from '../api/usersApi';
import type { AdminUser, PageResponse, UserStatus } from '../types/users.types';

type UserScope = 'ALL' | 'AD_SYNCED' | 'PRIVILEGED' | 'LOCAL';

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const { pushToast } = useToast();
  const [data, setData] = useState<PageResponse<AdminUser> | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);

  // Smart Filters
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<UserScope>('ALL');
  const [roleFilter, setRoleFilter] = useState<number | ''>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Confirmations
  const [pendingStatusAction, setPendingStatusAction] = useState<{
    target: AdminUser;
    nextStatus: UserStatus;
  } | null>(null);

  // Edit Roles modal state
  const [editingRolesUser, setEditingRolesUser] = useState<AdminUser | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);

  const hasActiveFilters = Boolean(
    search ||
    scope !== 'ALL' ||
    roleFilter !== '' ||
    providerFilter ||
    statusFilter !== ''
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedProvider = providerFilter;
      let resolvedRoleId = roleFilter !== '' ? Number(roleFilter) : undefined;

      if (scope === 'AD_SYNCED') {
        resolvedProvider = 'ACTIVE_DIRECTORY';
      } else if (scope === 'LOCAL') {
        resolvedProvider = 'LOCAL';
      }

      const [usersPage, roleList] = await Promise.all([
        usersApi.search({
          search: search.trim() || undefined,
          status: statusFilter,
          authProvider: resolvedProvider || undefined,
          roleId: resolvedRoleId,
          page,
          size: pageSize,
        }),
        rolesApi.listRoles(),
      ]);

      // If PRIVILEGED scope is active, filter client-side for roles beyond default 'Employee'
      if (scope === 'PRIVILEGED') {
        const filteredContent = usersPage.content.filter((u) =>
          u.roles.some((r) => r.name !== 'Employee')
        );
        setData({
          ...usersPage,
          content: filteredContent,
          totalElements: filteredContent.length,
        });
      } else {
        setData(usersPage);
      }

      setRoles(roleList.filter((r) => r.active));
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, [search, scope, roleFilter, providerFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScopeChange = (nextScope: UserScope) => {
    setScope(nextScope);
    setRoleFilter('');
    setProviderFilter('');
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearch('');
    setScope('ALL');
    setRoleFilter('');
    setProviderFilter('');
    setStatusFilter('');
    setPage(0);
  };

  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await usersApi.syncLdap();
      const msg = `AD Sync finished in ${res.durationMs}ms: ${res.usersScanned} accounts scanned, ${res.rolesAssigned} roles reconciled.`;
      pushToast({ title: 'Active Directory Sync Complete', message: msg, tone: 'ok' });
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      pushToast({
        title: 'AD Sync Failed',
        message: ax.response?.data?.message || 'Failed to sync with Active Directory',
        tone: 'err',
      });
    } finally {
      setSyncing(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusAction) return;
    const { target, nextStatus } = pendingStatusAction;
    setBusy(true);
    setBanner(null);
    try {
      await usersApi.updateStatus(target.id, nextStatus, `Changed by ${currentUser?.username}`);
      const message = `Updated status for "${target.username}" to ${nextStatus}.`;
      setBanner({ type: 'ok', text: message });
      pushToast({ title: 'User status updated', message, tone: 'ok' });
      setPendingStatusAction(null);
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Status update failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (target: AdminUser) => {
    setBusy(true);
    setBanner(null);
    try {
      await usersApi.unlock(target.id);
      const message = `Temporary lockout cleared for "${target.username}".`;
      setBanner({ type: 'ok', text: message });
      pushToast({ title: 'Account unlocked', message, tone: 'ok' });
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Unlock failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRoles = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRolesUser || editRoleIds.length === 0) return;
    setBusy(true);
    setBanner(null);
    try {
      await usersApi.updateRoles(editingRolesUser.id, editRoleIds);
      const message = `Roles updated for "${editingRolesUser.username}".`;
      setBanner({ type: 'ok', text: message });
      pushToast({ title: 'Roles saved', message, tone: 'ok' });
      setEditingRolesUser(null);
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to update roles' });
    } finally {
      setBusy(false);
    }
  };

  const toggleId = (id: number, current: number[], setter: (next: number[]) => void) => {
    setter(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  return (
    <div className="apid-card">
      {/* Level 1: Scope Quick Pills */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginRight: '0.2rem' }}>
          User Category:
        </span>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${scope === 'ALL' && !providerFilter ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => handleScopeChange('ALL')}
        >
          All Users ({data?.totalElements ?? 154})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${scope === 'AD_SYNCED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => handleScopeChange('AD_SYNCED')}
        >
          🏛️ AD Synced Staff (150)
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${scope === 'PRIVILEGED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => handleScopeChange('PRIVILEGED')}
        >
          ⭐ Privileged Roles (Admin/Coach/Mentor)
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${scope === 'LOCAL' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => handleScopeChange('LOCAL')}
        >
          🔒 Local System (4)
        </button>

        <button
          type="button"
          className="apid-btn apid-btn-sm apid-btn-outline"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={syncing || busy}
          onClick={handleManualSync}
          title="Trigger immediate Active Directory synchronization and role reconciliation (Scheduled cadence configured in Coaching Rules & Policies)"
        >
          <span>{syncing ? '⏳ Syncing AD...' : '🔄 Sync Active Directory'}</span>
        </button>
      </div>

      {/* Level 2: Smart Filter Toolbar */}
      <div
        className="apid-toolbar-left"
        style={{
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {/* Full-Text Smart Search */}
        <input
          type="text"
          className="apid-input"
          style={{ minWidth: '240px', flex: '1 1 220px' }}
          placeholder="Search name, @username, emp #, dept..."
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
        />

        {/* Filter by APID Role */}
        <select
          className="apid-input"
          style={{ flex: '1 1 180px' }}
          value={roleFilter}
          onChange={(e) => {
            setPage(0);
            setRoleFilter(e.target.value ? Number(e.target.value) : '');
          }}
        >
          <option value="">All Application Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Filter by Authentication Provider */}
        <select
          className="apid-input"
          style={{ flex: '1 1 180px' }}
          value={providerFilter}
          onChange={(e) => {
            setPage(0);
            setProviderFilter(e.target.value);
            if (e.target.value) setScope('ALL');
          }}
        >
          <option value="">All Providers</option>
          <option value="ACTIVE_DIRECTORY">Active Directory DS (apid.test)</option>
          <option value="LOCAL">Local System Credentials</option>
        </select>

        {/* Filter by Status */}
        <select
          className="apid-input"
          style={{ flex: '0 1 140px' }}
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value as UserStatus | '');
          }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
          <option value="ADMIN_LOCKED">ADMIN_LOCKED</option>
        </select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={handleResetFilters}
            title="Clear all active filters"
          >
            Reset Filters ✕
          </button>
        )}
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : !data || data.content.length === 0 ? (
        <div className="apid-alert apid-alert-info">
          No user accounts match the selected filters.
        </div>
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>User & Employee Profile</th>
                <th style={{ width: '130px' }}>Auth Provider</th>
                <th style={{ width: '90px' }}>Status</th>
                <th>Assigned Roles (APID)</th>
                <th style={{ width: '160px' }}>Last Login</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isAdUser = u.authProvider === 'ACTIVE_DIRECTORY';
                return (
                  <tr key={u.id}>
                    <td>
                      {u.fullName ? (
                        <>
                          <strong style={{ fontSize: '0.95rem' }}>{u.fullName}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                            <span style={{ color: 'var(--info)', fontWeight: 600 }}>@{u.username}</span>
                            {u.employeeNumber && <span> • Emp #{u.employeeNumber}</span>}
                            {u.departmentName && <span> • {u.departmentName}</span>}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.95rem' }}>@{u.username}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            Local System Account
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {isAdUser ? (
                        <span
                          className="boa-pill boa-pill-info"
                          title="Authenticated via Active Directory Domain Services (apid.test)"
                        >
                          AD Synced
                        </span>
                      ) : (
                        <span className="boa-pill boa-pill-neutral">Local System</span>
                      )}
                    </td>
                    <td>
                      <span className={`apid-status apid-status-${u.status.toLowerCase()}`}>
                        {u.status}
                      </span>
                      {u.temporarilyLocked && (
                        <span className="apid-status apid-status-templock" style={{ marginLeft: '0.35rem' }}>
                          TEMP LOCKED
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {u.roles.map((r) => (
                          <span
                            key={r.id}
                            className={`boa-pill ${r.name === 'Super Admin' ? 'boa-pill-warn' : 'boa-pill-neutral'}`}
                            style={{ fontSize: '0.72rem' }}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="apid-actions-cell" style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="apid-btn apid-btn-sm"
                        disabled={busy}
                        title="Manage APID system roles & permissions"
                        onClick={() => {
                          setEditingRolesUser(u);
                          setEditRoleIds(u.roles.map((r) => r.id));
                        }}
                      >
                        Roles
                      </button>
                      {u.temporarilyLocked && (
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          disabled={busy}
                          onClick={() => handleUnlock(u)}
                        >
                          Unlock
                        </button>
                      )}
                      {u.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm apid-btn-danger"
                          disabled={busy || isSelf}
                          title={isSelf ? 'Cannot disable your own account' : 'Disable access to APID'}
                          onClick={() => setPendingStatusAction({ target: u, nextStatus: 'DISABLED' })}
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          disabled={busy}
                          onClick={() => setPendingStatusAction({ target: u, nextStatus: 'ACTIVE' })}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination & Rows Per Page Controls */}
      {data && (
        <div
          className="apid-pagination"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Rows per page:</span>
            <select
              className="apid-input"
              style={{ width: 'auto', padding: '0.2rem 0.5rem', height: '32px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="apid-btn apid-btn-sm apid-btn-outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <span style={{ fontSize: '0.85rem' }}>
              Page {data.number + 1} of {Math.max(1, data.totalPages)} ({data.totalElements} users)
            </span>
            <button
              type="button"
              className="apid-btn apid-btn-sm apid-btn-outline"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Roles Modal */}
      {editingRolesUser && (
        <div className="apid-modal-backdrop">
          <div className="apid-card apid-modal">
            <h3>Edit Roles: {editingRolesUser.fullName ? `${editingRolesUser.fullName} (@${editingRolesUser.username})` : editingRolesUser.username}</h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
              Assign or revoke APID application roles. Permissions associated with selected roles apply immediately.
            </p>
            <form onSubmit={handleSaveRoles} className="apid-form">
              <div className="apid-field">
                <label>Assigned Application Roles</label>
                <div className="apid-checkbox-list">
                  {roles.map((r) => (
                    <label key={r.id} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={editRoleIds.includes(r.id)}
                        onChange={() => toggleId(r.id, editRoleIds, setEditRoleIds)}
                      />
                      <span>
                        {r.name} {r.systemProtected ? '(Protected)' : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setEditingRolesUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={busy}>
                  {busy ? 'Saving...' : 'Save Roles'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingStatusAction)}
        title={pendingStatusAction?.nextStatus === 'ACTIVE' ? 'Re-activate Account' : 'Disable Account'}
        message={
          pendingStatusAction
            ? `Are you sure you want to set "${pendingStatusAction.target.username}" to ${pendingStatusAction.nextStatus}?`
            : ''
        }
        confirmLabel={pendingStatusAction?.nextStatus === 'ACTIVE' ? 'Activate' : 'Disable'}
        danger={pendingStatusAction?.nextStatus !== 'ACTIVE'}
        busy={busy}
        onCancel={() => setPendingStatusAction(null)}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
