import { useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { rolesApi } from '../../roles/api/rolesApi';
import type { RoleItem } from '../../roles/types/roles.types';
import { organizationApi } from '../api/organizationApi';
import type { EmployeeItem } from '../types/organization.types';

interface LinkUserModalProps {
  employee: EmployeeItem;
  onClose: () => void;
  onUpdated: (message: string) => Promise<void> | void;
}

interface CreatedCredentialView {
  username: string;
  temporaryPassword: string;
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
  const canManageAccount =
    hasPermission('HIERARCHY_MANAGE') && hasPermission('USER_MANAGE');
  const isLinked = employee.userId != null;

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [newUsername, setNewUsername] = useState(() => suggestUsername(employee));
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredentialView | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageAccount || isLinked) return;
    let active = true;
    setRolesLoading(true);
    rolesApi
      .listRoles()
      .then((list) => {
        if (!active) return;
        const activeRoles = list.filter((role) => role.active);
        setRoles(activeRoles);
        const employeeRole = activeRoles.find((role) => role.name.toLowerCase() === 'employee');
        if (employeeRole) setSelectedRoleIds([employeeRole.id]);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const ax = err as AxiosError<ApiErrorPayload>;
        setErrorMsg(ax.response?.data?.message || 'Failed to load account roles.');
      })
      .finally(() => {
        if (active) setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManageAccount, isLinked]);

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((previous) =>
      previous.includes(roleId)
        ? previous.filter((id) => id !== roleId)
        : [...previous, roleId]
    );
  };

  const handleCreateAndLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageAccount) return;
    const username = newUsername.trim();
    if (username.length < 3) {
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
      const result = await organizationApi.createAndLinkEmployeeUser(employee.id, {
        username,
        roleIds: selectedRoleIds,
      });
      setShowSecret(false);
      setCreatedCredential({
        username: result.username,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to create and link the user account.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!canManageAccount) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await organizationApi.revokeEmployeeUserLink(employee.id);
      await onUpdated(`Revoked the login link for "${employee.fullName}" and deleted the login account.`);
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to revoke the employee login link.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinishCredentialView = async () => {
    const credential = createdCredential;
    setShowSecret(false);
    setCreatedCredential(null);
    if (credential) {
      await onUpdated(
        `Created and linked @${credential.username} to "${employee.fullName}" (${employee.employeeNumber}).`
      );
    }
    onClose();
  };

  return (
    <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="link-user-modal-title">
      <div className="apid-modal apid-card" style={{ maxWidth: '540px' }}>
        <h3 id="link-user-modal-title">
          {createdCredential
            ? 'One-Time Login Credential Issued'
            : isLinked
              ? `Revoke Employee Login — ${employee.fullName}`
              : `Create Employee Login — ${employee.fullName}`}
        </h3>
        <p className="apid-subtitle">
          Employee #{employee.employeeNumber} • Current link:{' '}
          <strong>{employee.username ? `@${employee.username}` : 'Unlinked'}</strong>
        </p>

        {errorMsg && <div className="apid-alert apid-alert-err">{errorMsg}</div>}

        {!canManageAccount ? (
          <div className="apid-alert apid-alert-err">
            You need both hierarchy-management and user-management permissions to manage employee login accounts.
          </div>
        ) : createdCredential ? (
          <div>
            <p className="boa-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
              Account <strong>@{createdCredential.username}</strong> has been linked to this employee profile. This
              temporary password is shown once and cleared from memory when closed. Password change is enforced on
              first sign-in.
            </p>
            <div className="boa-secret-box">
              <div className="boa-secret-value" data-testid="link-modal-masked-credential">
                {showSecret ? createdCredential.temporaryPassword : '••••••••••••••••'}
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-sm"
                onClick={() => setShowSecret((previous) => !previous)}
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
        ) : isLinked ? (
          <>
            <p className="apid-alert apid-alert-info">
              Revoking permanently deletes @{employee.username}'s login account, role assignments, and active
              sessions while preserving business and audit history. If retained records require this account, the
              revoke will be blocked and the link will remain.
            </p>
            <div className="apid-modal-actions">
              <button type="button" className="apid-btn apid-btn-outline" disabled={saving} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-danger"
                disabled={saving}
                onClick={handleRevoke}
              >
                {saving ? 'Revoking...' : 'Revoke Link & Delete Account'}
              </button>
            </div>
          </>
        ) : (
          <form className="apid-form" onSubmit={handleCreateAndLink}>
            <div className="apid-field">
              <label htmlFor="create-link-username">Username</label>
              <input
                id="create-link-username"
                type="text"
                className="apid-input"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                minLength={3}
                maxLength={100}
                required
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                After a successful revoke, the same username can be used for a fresh account with a new one-time
                password and the roles selected below.
              </span>
            </div>

            <div className="apid-field">
              <label>Assign Roles</label>
              <div className="apid-checkbox-list">
                {roles.map((role) => (
                  <label key={role.id} className="apid-checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
                {rolesLoading && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Loading active roles...</span>
                )}
                {!rolesLoading && roles.length === 0 && !errorMsg && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    No active roles are available.
                  </span>
                )}
              </div>
            </div>

            <div className="apid-modal-actions">
              <button type="button" className="apid-btn apid-btn-outline" disabled={saving} onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="apid-btn apid-btn-primary"
                disabled={saving || rolesLoading || roles.length === 0}
              >
                {saving ? 'Creating & Linking...' : 'Create Account & Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
