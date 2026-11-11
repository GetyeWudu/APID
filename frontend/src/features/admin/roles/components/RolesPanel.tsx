import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { rolesApi } from '../api/rolesApi';
import type { PermissionItem, RoleItem } from '../types/roles.types';

export function RolesPanel() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>(['EMPLOYEE_PORTAL_ACCESS']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleList, permList] = await Promise.all([
        rolesApi.listRoles(),
        rolesApi.listPermissions(),
      ]);
      setRoles(roleList);
      setPermissions(permList);
      if (roleList.length > 0 && !selectedRole) {
        setSelectedRole(roleList[0]);
        setDraftPerms(roleList[0].permissions);
      }
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load roles' });
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const permsByModule = useMemo(() => {
    const grouped: Record<string, PermissionItem[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  }, [permissions]);

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRole(role);
    setDraftPerms(role.permissions);
    setBanner(null);
  };

  const toggleDraftPerm = (code: string) => {
    setDraftPerms((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    if (
      !window.confirm(
        `Update permissions for "${selectedRole.name}"? Changes take effect immediately for all logged-in users.`
      )
    ) {
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const updated = await rolesApi.updateRolePermissions(selectedRole.id, draftPerms);
      setSelectedRole(updated);
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setBanner({ type: 'ok', text: `Permissions updated for "${updated.name}". Redis cache evicted.` });
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Permission update failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const created = await rolesApi.createRole({
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
        permissionCodes: newRolePerms,
      });
      setShowCreate(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setRoles((prev) => [...prev, created]);
      setSelectedRole(created);
      setDraftPerms(created.permissions);
      setBanner({ type: 'ok', text: `Role "${created.name}" created.` });
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Role creation failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="apid-card">
      <div className="apid-toolbar">
        <h3 style={{ margin: 0 }}>Dynamic Roles &amp; Permissions Matrix</h3>
        <button type="button" className="apid-btn apid-btn-primary" onClick={() => setShowCreate(true)}>
          + Create Role
        </button>
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      {loading && roles.length === 0 ? (
        <p>Loading roles...</p>
      ) : (
        <div className="apid-split-layout">
          <div className="apid-role-list">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`apid-role-item ${selectedRole?.id === r.id ? 'active' : ''}`}
                onClick={() => handleSelectRole(r)}
              >
                <div style={{ fontWeight: 600 }}>
                  {r.name} {r.systemProtected ? '🔒' : ''}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {r.permissions.length} permissions · {r.activeUserCount} active users
                </div>
              </button>
            ))}
          </div>

          {selectedRole && (
            <div className="apid-role-editor">
              <div className="apid-toolbar" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <strong>{selectedRole.name}</strong>
                  {selectedRole.systemProtected && (
                    <span className="apid-badge" style={{ marginLeft: '0.5rem' }}>
                      System Protected
                    </span>
                  )}
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {selectedRole.description}
                  </div>
                </div>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary"
                  disabled={busy}
                  onClick={handleSavePermissions}
                >
                  {busy ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>

              {Object.entries(permsByModule).map(([module, items]) => (
                <div key={module} className="apid-perm-group">
                  <div className="apid-perm-group-title">{module}</div>
                  {items.map((p) => (
                    <label key={p.code} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={draftPerms.includes(p.code)}
                        onChange={() => toggleDraftPerm(p.code)}
                      />
                      <span>
                        <code>{p.code}</code> — {p.description}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="apid-modal-backdrop">
          <div className="apid-card apid-modal">
            <h3>Create Custom Role</h3>
            <form onSubmit={handleCreateRole} className="apid-form">
              <div className="apid-field">
                <label>Role Name</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                />
              </div>
              <div className="apid-field">
                <label>Description</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                />
              </div>
              <div className="apid-field">
                <label>Initial Permissions</label>
                <div className="apid-checkbox-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {permissions.map((p) => (
                    <label key={p.code} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={newRolePerms.includes(p.code)}
                        onChange={() =>
                          setNewRolePerms((prev) =>
                            prev.includes(p.code) ? prev.filter((c) => c !== p.code) : [...prev, p.code]
                          )
                        }
                      />
                      <span>{p.code}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="apid-modal-actions">
                <button type="button" className="apid-btn apid-btn-outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={busy}>
                  {busy ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

