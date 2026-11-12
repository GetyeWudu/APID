import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { ConfirmDialog, useToast } from '../../../../shared/components/ui';
import { rolesApi } from '../../roles/api/rolesApi';
import type { RoleItem } from '../../roles/types/roles.types';
import { usersApi } from '../api/usersApi';
import type { AdminUser, PageResponse, UserStatus } from '../types/users.types';

interface CredentialModalState {
  username: string;
  temporaryPassword: string;
  mode: 'created' | 'reset';
}

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const { pushToast } = useToast();
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

  // Masked-by-default single-display credential modal (never copies to clipboard or persists)
  const [credentialModal, setCredentialModal] = useState<CredentialModalState | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Confirmations
  const [pendingStatusAction, setPendingStatusAction] = useState<{
    target: AdminUser;
    nextStatus: UserStatus;
  } | null>(null);
  const [pendingResetTarget, setPendingResetTarget] = useState<AdminUser | null>(null);

  // Edit Roles modal state
  const [editingRolesUser, setEditingRolesUser] = useState<AdminUser | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);

  useEffect(() => {
    return () => {
      setCredentialModal(null);
      setShowSecret(false);
    };
  }, []);

  const closeCredentialModal = () => {
    setShowSecret(false);
    setCredentialModal(null);
  };

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
      setShowSecret(false);
      setCredentialModal({
        username: res.user.username,
        temporaryPassword: res.temporaryPassword,
        mode: 'created',
      });
      setShowCreate(false);
      setNewUsername('');
      setSelectedRoleIds([]);
      pushToast({ title: 'User created', message: `Account "${res.user.username}" created.`, tone: 'ok' });
      await loadData();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to create user' });
    } finally {
      setBusy(false);
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

  const confirmResetPassword = async () => {
    if (!pendingResetTarget) return;
    const target = pendingResetTarget;
    setBusy(true);
    setBanner(null);
    try {
      const res = await usersApi.resetPassword(target.id);
      setPendingResetTarget(null);
      setShowSecret(false);
      setCredentialModal({
        username: res.username,
        temporaryPassword: res.temporaryPassword,
        mode: 'reset',
      });
      pushToast({ title: 'Password reset', message: `Temporary password rotated for "${res.username}".`, tone: 'info' });
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
            closeCredentialModal();
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
                        onClick={() => setPendingResetTarget(u)}
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
                <label htmlFor="create-username">Username</label>
                <input
                  id="create-username"
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

      {credentialModal && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credential-modal-title"
        >
          <div className="apid-card apid-modal">
            <h3 id="credential-modal-title">
              {credentialModal.mode === 'created' ? 'One-Time Account Credential' : 'One-Time Reset Credential'}
            </h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
              Account: <strong>{credentialModal.username}</strong>. This temporary secret is shown once and
              cleared from memory when closed. Deliver directly over an authorized channel; password change is
              enforced on first sign-in.
            </p>
            <div className="boa-secret-box">
              <div className="boa-secret-value" data-testid="masked-credential-value">
                {showSecret ? credentialModal.temporaryPassword : '••••••••••••••••'}
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-sm"
                onClick={() => setShowSecret((prev) => !prev)}
              >
                {showSecret ? 'Hide password' : 'Reveal password'}
              </button>
            </div>
            <div className="apid-alert apid-alert-info" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
              Security Notice: Copy to clipboard is disabled for temporary passwords. Share this password directly with the user.
            </div>
            <div className="apid-modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="apid-btn apid-btn-primary" onClick={closeCredentialModal}>
                I Have Delivered This Securely
              </button>
            </div>
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

      <ConfirmDialog
        open={Boolean(pendingResetTarget)}
        title="Reset Temporary Password"
        message={
          pendingResetTarget
            ? `Generate a new temporary password for "${pendingResetTarget.username}" and revoke all active sessions?`
            : ''
        }
        confirmLabel="Reset Password"
        danger
        busy={busy}
        onCancel={() => setPendingResetTarget(null)}
        onConfirm={confirmResetPassword}
      />
    </div>
  );
}

