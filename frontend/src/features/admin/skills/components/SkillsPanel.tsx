import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { skillsApi } from '../api/skillsApi';
import type { SkillItem } from '../types/skills.types';

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await skillsApi.listAdmin({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === 'ALL' ? '' : activeFilter === 'ACTIVE',
      });
      setSkills(data);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load skills catalog' });
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, activeFilter]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const openCreateModal = () => {
    setEditingSkill(null);
    setFormName('');
    setFormCategory('');
    setFormDescription('');
    setBanner(null);
    setShowModal(true);
  };

  const openEditModal = (skill: SkillItem) => {
    setEditingSkill(skill);
    setFormName(skill.name);
    setFormCategory(skill.category);
    setFormDescription(skill.description ?? '');
    setBanner(null);
    setShowModal(true);
  };

  const handleSaveSkill = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        name: formName.trim(),
        category: formCategory.trim(),
        description: formDescription.trim() || undefined,
      };
      if (editingSkill) {
        await skillsApi.update(editingSkill.id, payload);
        setBanner({ type: 'ok', text: `Skill "${payload.name}" updated.` });
      } else {
        await skillsApi.create(payload);
        setBanner({ type: 'ok', text: `Skill "${payload.name}" added to shared catalog.` });
      }
      setShowModal(false);
      loadSkills();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to save skill' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (skill: SkillItem) => {
    const targetActive = !skill.active;
    if (
      !window.confirm(
        `${targetActive ? 'Activate' : 'Deactivate'} skill "${skill.name}"? ${
          targetActive ? '' : 'Deactivated skills remain in historical records but cannot be picked for new sessions.'
        }`
      )
    ) {
      return;
    }
    setBusyId(skill.id);
    setBanner(null);
    try {
      await skillsApi.updateStatus(skill.id, targetActive);
      setBanner({
        type: 'ok',
        text: `Skill "${skill.name}" is now ${targetActive ? 'active' : 'inactive'}.`,
      });
      loadSkills();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Status update failed' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="apid-card">
      <div className="apid-toolbar">
        <div className="apid-toolbar-left">
          <input
            type="text"
            className="apid-input"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="apid-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className="apid-input"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
        <button type="button" className="apid-btn apid-btn-primary" onClick={openCreateModal}>
          + Add Skill
        </button>
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      <div className="apid-table-wrap">
        <table className="apid-table">
          <thead>
            <tr>
              <th>Skill Name</th>
              <th>Category</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Loading skills catalog...</td>
              </tr>
            ) : skills.length === 0 ? (
              <tr>
                <td colSpan={5}>No skills match your filter criteria.</td>
              </tr>
            ) : (
              skills.map((skill) => (
                <tr key={skill.id}>
                  <td>
                    <strong>{skill.name}</strong>
                  </td>
                  <td>{skill.category}</td>
                  <td>{skill.description || '—'}</td>
                  <td>
                    <span className={`apid-status ${skill.active ? 'apid-status-active' : 'apid-status-disabled'}`}>
                      {skill.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="apid-actions-cell">
                    <button
                      type="button"
                      className="apid-btn apid-btn-sm"
                      disabled={busyId === skill.id}
                      onClick={() => openEditModal(skill)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`apid-btn apid-btn-sm ${skill.active ? 'apid-btn-danger' : ''}`}
                      disabled={busyId === skill.id}
                      onClick={() => handleToggleStatus(skill)}
                    >
                      {skill.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="apid-modal-backdrop">
          <div className="apid-modal apid-card">
            <h3>{editingSkill ? 'Edit Master Skill' : 'Add Master Skill'}</h3>
            <form className="apid-form" onSubmit={handleSaveSkill}>
              <div className="apid-field">
                <label htmlFor="skill-name">Skill Name</label>
                <input
                  id="skill-name"
                  className="apid-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>
              <div className="apid-field">
                <label htmlFor="skill-category">Category</label>
                <input
                  id="skill-category"
                  className="apid-input"
                  placeholder="e.g. Technical, Banking Operations, Leadership"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="apid-field">
                <label htmlFor="skill-desc">Description</label>
                <input
                  id="skill-desc"
                  className="apid-input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingSkill ? 'Save Changes' : 'Create Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

