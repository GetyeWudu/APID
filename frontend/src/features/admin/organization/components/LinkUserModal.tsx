import { useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { rolesApi } from '../../roles/api/rolesApi';
import type { RoleItem } from '../../roles/types/roles.types';
import { usersApi } from '../../users/api/usersApi';
import { organizationApi } from '../api/organizationApi';
import type { EmployeeItem, UserAccountSummary } from '../types/organization.types';

interface LinkUserModalProps {
  employee: EmployeeItem;
  onClose: () => void;
  onUpdated: (message: string) => Promise<void> | void;
}

type ModalMode = 'existing' | 'create';

interface CreatedCredentialView {
  username: string;
  temporaryPassword: string;
  linked: boolean;
}

function suggestUsername(employee: EmployeeItem): string {
  const emailLocal = employee.email?.split('@')[0]?.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (emailLocal && emailLocal.length >= 3) {
    return emailLocal;
  }
  return employee.employeeNumber.toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export function LinkUserModal({ employee, onClose, onUpdated }: LinkUserModalProps) {
  const { hasPermission } = useAuth();
  const canCreateUser = hasPermission('USER_MANAGE');

  const [mode, setMode] = useState<ModalMode>('existing');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<UserAccountSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(employee.userId);
  const [loading, setLoading] = useState(true);

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [newUsername, setNewUsername] = useState(() => suggestUsername(employee));
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredentialView | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setCreatedCredential(null);
      setShowSecret(false);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const list = await organizationApi.listAvailableUsers(employee.userId, search);
        if (active) setCandidates(list);
      } catch {
        if (active) setCandidates([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [employee.userId, search]);

  useEffect(() => {
    if (!canCreateUser || mode !== 'create' || roles.length > 0) return;
    let active = true;
    rolesApi
      .listRoles()
      .then((list) => {
        if (!active) return;
        const activeRoles = list.filter((r) => r.active);
        setRoles(activeRoles);
        const employeeRole = activeRoles.find((r) => r.name.toLowerCase() === 'employee');
        if (employeeRole) {
          setSelectedRoleIds((prev) => (prev.length === 0 ? [employeeRole.id] : prev));
        }
      })
      .catch(() => {
        if (active) setRoles([]);
      });
    return () => {
      active = false;
    };
  }, [canCreateUser, mode, roles.length]);

  const handleLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await organizationApi.linkEmployeeUser(employee.id, selectedUserId);
      await onUpdated(`Linked login account to employee "${employee.fullName}" (${employee.employeeNumber}).`);
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to link user account');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreateUser) return;
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (selectedRoleIds.length === 0) {
      setErrorMsg('Select at least one role for the new user account.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const created = await usersApi.create({ username: trimmed, roleIds: selectedRoleIds });
      let linked = false;
      try {
        await organizationApi.linkEmployeeUser(employee.id, created.user.id);
        linked = true;
      } catch (linkErr) {
        const ax = linkErr as AxiosError<ApiErrorPayload>;
        setErrorMsg(
          ax.response?.data?.message ||
            'User account was created, but automatic linking failed. Record the one-time credential below and link manually.'
        );
      }
      setShowSecret(false);
      setCreatedCredential({
        username: created.user.username,
        temporaryPassword: created.temporaryPassword,
        linked,
      });
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to create user account');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await organizationApi.unlinkEmployeeUser(employee.id);
      await onUpdated(`Unlinked login account from "${employee.fullName}".`);
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to unlink user account');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleFinishCredentialView = async () => {
    const cred = createdCredential;
    setShowSecret(false);
    setCreatedCredential(null);
    if (cred?.linked) {
      await onUpdated(`Created and linked @${cred.username} to "${employee.fullName}" (${employee.employeeNumber}).`);
    }
    onClose();
  };

  return (
    <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="link-user-modal-title">
      <div className="apid-modal apid-card" style={{ maxWidth: '540px' }}>
        <h3 id="link-user-modal-title">
          {createdCredential ? 'One-Time Login Credential Issued' : `Login Account — ${employee.fullName}`}
        </h3>
        <p className="apid-subtitle">
          Employee #{employee.employeeNumber} • Current link:{' '}
          <strong>{employee.username ? `@${employee.username}` : 'Unlinked'}</strong>. Linking is explicit and
          recorded in Audit Logs.
        </p>

        {errorMsg && <div className="apid-alert apid-alert-err">{errorMsg}</div>}

        {createdCredential ? (
          <div>
            <p className="boa-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
              Account <strong>@{createdCredential.username}</strong>{' '}
              {createdCredential.linked ? 'has been linked to this employee profile.' : 'was created.'} This
              temporary secret is shown once and cleared from memory when closed. Password change is enforced on
              first sign-in.
            </p>
            <div className="boa-secret-box">
              <div className="boa-secret-value" data-testid="link-modal-masked-credential">
                {showSecret ? createdCredential.temporaryPassword : '••••••••••••••••'}
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
              Security Notice: Clipboard copy is intentionally disabled for temporary credentials.
            </div>
            <div className="apid-modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="apid-btn apid-btn-primary" onClick={handleFinishCredentialView}>
                Done &amp; Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {canCreateUser && (
              <div className="apid-toolbar" style={{ marginBottom: '0.75rem' }}>
                <div className="apid-toolbar-left">
                  <button
                    type="button"
                    className={`apid-tab ${mode === 'existing' ? 'active' : ''}`}
                    onClick={() => {
                      setMode('existing');
                      setErrorMsg(null);
                    }}
                  >
                    Link Existing User
                  </button>
                  <button
                    type="button"
                    className={`apid-tab ${mode === 'create' ? 'active' : ''}`}
                    onClick={() => {
                      setMode('create');
                      setErrorMsg(null);
                    }}
                  >
                    Create New User &amp; Link
                  </button>
                </div>
              </div>
            )}

            {mode === 'existing' ? (
              <form className="apid-form" onSubmit={handleLink}>
                <div className="apid-field">
                  <label htmlFor="link-user-search">Search Unlinked User Accounts</label>
                  <input
                    id="link-user-search"
                    type="text"
                    className="apid-input"
                    placeholder="Search username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="apid-field">
                  <label htmlFor="link-user-select">Select User Account</label>
                  <select
                    id="link-user-select"
                    className="apid-input"
                    value={selectedUserId ?? ''}
                    onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— Select user account —</option>
                    {candidates.map((u) => {
                      const isExactMatch = u.username.toLowerCase() === employee.employeeNumber.toLowerCase();
                      return (
                        <option key={u.id} value={u.id}>
                          @{u.username} ({u.status}){isExactMatch ? ' ★ Matches Emp #' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {loading && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Loading available users...</span>
                  )}
                </div>

                <div className="apid-modal-actions">
                  {employee.userId != null && (
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-danger"
                      disabled={saving}
                      onClick={handleUnlink}
                    >
                      Unlink Current User
                    </button>
                  )}
                  <button type="button" className="apid-btn apid-btn-outline" disabled={saving} onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="apid-btn apid-btn-primary" disabled={saving || !selectedUserId}>
                    {saving ? 'Linking...' : 'Confirm Link'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="apid-form" onSubmit={handleCreateAndLink}>
                <div className="apid-field">
                  <label htmlFor="create-link-username">New Username (temp password auto-generated)</label>
                  <input
                    id="create-link-username"
                    type="text"
                    className="apid-input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    minLength={3}
                    required
                  />
                </div>

                <div className="apid-field">
                  <label>Assign Roles</label>
                  <div className="apid-checkbox-list">
                    {roles.map((r) => (
                      <label key={r.id} className="apid-checkbox-row">
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                    {roles.length === 0 && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Loading active roles...</span>
                    )}
                  </div>
                </div>

                <div className="apid-modal-actions">
                  <button type="button" className="apid-btn apid-btn-outline" disabled={saving} onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="apid-btn apid-btn-primary" disabled={saving}>
                    {saving ? 'Creating & Linking...' : 'Create Account & Link'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
