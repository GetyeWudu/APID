import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { rolesApi } from '../../roles/api/rolesApi';
import type { RoleItem } from '../../roles/types/roles.types';
import { usersApi } from '../api/usersApi';
import type { AdminUser, PageResponse, UserStatus } from '../types/users.types';

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<PageResponse<AdminUser> | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Create User modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);

  // Edit Roles modal state
  const [editingRolesUser, setEditingRolesUser] = useState<AdminUser | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersPage, roleList] = await Promise.all([
        usersApi.search({ search, status: statusFilter, page, size: 15 }),
        rolesApi.listRoles(),
      ]);
      setData(usersPage);
      setRoles(roleList.filter((r) => r.active));
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedRoleIds.length === 0) {
      setBanner({ type: 'err', text: 'Select at least one role.' });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const res = await usersApi.create({ username: newUsername.trim(), roleIds: selectedRoleIds });
      setOneTimeSecret(
        `User "${res.user.username}" created. One-time temporary password (copy now, shown once): ${res.temporaryPassword}`
      );
      setShowCreate(false);
      setNewUsername('');
      setSelectedRoleIds([]);
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to create user' });
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (target: AdminUser, nextStatus: UserStatus) => {
    const actionLabel = nextStatus === 'ACTIVE' ? 're-activate' : nextStatus.toLowerCase();
    if (!window.confirm(`Are you sure you want to set "${target.username}" to ${actionLabel}?`)) {
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      await usersApi.updateStatus(target.id, nextStatus, `Changed by ${currentUser?.username}`);
      setBanner({ type: 'ok', text: `Updated status for "${target.username}" to ${nextStatus}.` });
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
      setBanner({ type: 'ok', text: `Temporary lockout cleared for "${target.username}".` });
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Unlock failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (target: AdminUser) => {
    if (!window.confirm(`Reset password for "${target.username}" and revoke all active sessions?`)) {
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const res = await usersApi.resetPassword(target.id);
      setOneTimeSecret(
        `Temporary password for "${res.username}" (shown once, deliver securely): ${res.temporaryPassword}`
      );
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Password reset failed' });
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
      setBanner({ type: 'ok', text: `Roles updated for "${editingRolesUser.username}".` });
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
      <div className="apid-toolbar">
        <div className="apid-toolbar-left">
          <input
            type="text"
            className="apid-input"
            placeholder="Search username..."
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
          />
          <select
            className="apid-input"
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
        </div>
        <button
          type="button"
          className="apid-btn apid-btn-primary"
          onClick={() => {
            setOneTimeSecret(null);
            setShowCreate(true);
          }}
        >
          + Create User
        </button>
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      {oneTimeSecret && (
        <div className="apid-alert apid-alert-ok" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {oneTimeSecret}
        </div>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Must Change PW</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
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
                    <td>{u.roles.map((r) => r.name).join(', ') || 'None'}</td>
                    <td>{u.mustChangePassword ? 'Yes' : 'No'}</td>
                    <td className="apid-actions-cell">
                      <button
                        type="button"
                        className="apid-btn apid-btn-sm"
                        disabled={busy}
                        onClick={() => {
                          setEditingRolesUser(u);
                          setEditRoleIds(u.roles.map((r) => r.id));
                        }}
                      >
                        Roles
                      </button>
                      <button
                        type="button"
                        className="apid-btn apid-btn-sm"
                        disabled={busy}
                        onClick={() => handleResetPassword(u)}
                      >
                        Reset PW
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
                          title={isSelf ? 'Cannot disable your own account' : 'Disable account'}
                          onClick={() => handleStatusChange(u, 'DISABLED')}
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          disabled={busy}
                          onClick={() => handleStatusChange(u, 'ACTIVE')}
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

      {data && data.totalPages > 1 && (
        <div className="apid-pagination">
          <button
            type="button"
            className="apid-btn apid-btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>
            Page {data.number + 1} of {data.totalPages} ({data.totalElements} users)
          </span>
          <button
            type="button"
            className="apid-btn apid-btn-sm"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {showCreate && (
        <div className="apid-modal-backdrop">
          <div className="apid-card apid-modal">
            <h3>Create User</h3>
            <form onSubmit={handleCreateUser} className="apid-form">
              <div className="apid-field">
                <label>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="apid-field">
                <label>Assign Roles (temp password auto-generated)</label>
                <div className="apid-checkbox-list">
                  {roles.map((r) => (
                    <label key={r.id} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(r.id)}
                        onChange={() => toggleId(r.id, selectedRoleIds, setSelectedRoleIds)}
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="apid-modal-actions">
                <button type="button" className="apid-btn apid-btn-outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={busy}>
                  {busy ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingRolesUser && (
        <div className="apid-modal-backdrop">
          <div className="apid-card apid-modal">
            <h3>Edit Roles: {editingRolesUser.username}</h3>
            <form onSubmit={handleSaveRoles} className="apid-form">
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
    </div>
  );
}

