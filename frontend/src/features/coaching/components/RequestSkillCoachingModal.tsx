import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X, Search, GraduationCap } from 'lucide-react';
import {
  skillCoachingRequestApi,
  type CreateSkillCoachingRequestPayload,
} from '../api/skillCoachingRequestApi';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import { useToast } from '../../../shared/components/ui';
import type { EmployeeItem } from '../../admin/organization/types/organization.types';

interface DirectReportOption {
  id: number;
  employeeNumber: string;
  fullName: string;
  departmentName?: string | null;
  jobTitle?: string | null;
}

interface RequestSkillCoachingModalProps {
  isOpen: boolean;
  onClose: () => void;
  directReports: DirectReportOption[];
  currentEmployee: EmployeeItem;
  activeQuarterId: number;
  activeQuarterLabel: string;
  onSuccess?: () => void;
}

export function RequestSkillCoachingModal({
  isOpen,
  onClose,
  directReports,
  currentEmployee,
  activeQuarterId,
  activeQuarterLabel,
  onSuccess,
}: RequestSkillCoachingModalProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  // Coach selection mode: 'SELF' | 'HIGHER_MANAGER' | 'SPECIALIST'
  const [coachMode, setCoachMode] = useState<'SELF' | 'HIGHER_MANAGER' | 'SPECIALIST'>('SELF');
  const [customCoachId, setCustomCoachId] = useState<number | ''>('');
  const [skillTitle, setSkillTitle] = useState('');
  const [businessJustification, setBusinessJustification] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Search additional employees
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch active employees for coach selection or adding additional trainees
  const activeEmployeesQuery = useQuery({
    queryKey: ['core', 'active-employees-for-modal'],
    queryFn: () => organizationApi.searchEmployees({ status: 'ACTIVE', size: 100 }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const allActiveEmployees = (activeEmployeesQuery.data?.content ?? []) as EmployeeItem[];

  const createMutation = useMutation({
    mutationFn: (payload: CreateSkillCoachingRequestPayload) =>
      skillCoachingRequestApi.createRequest(payload),
    onSuccess: () => {
      pushToast({
        title: 'Skill Coaching Request Submitted',
        message: 'Your request has been routed to the PMS Admin for formal approval.',
        tone: 'ok',
      });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'my-skill-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'skill-requests', 'pending'] });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'skill-requests', 'all'] });
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to submit skill coaching request.';
      setFormError(msg);
      pushToast({
        title: 'Submission Failed',
        message: msg,
        tone: 'err',
      });
    },
  });

  const resetForm = () => {
    setSelectedEmpIds([]);
    setCoachMode('SELF');
    setCustomCoachId('');
    setSkillTitle('');
    setBusinessJustification('');
    setFormError(null);
    setSearchTerm('');
  };

  if (!isOpen) return null;

  const toggleSelectEmployee = (empId: number) => {
    setSelectedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const selectAllDirectReports = () => {
    const drIds = directReports.map((dr) => dr.id);
    const allSelected = drIds.every((id) => selectedEmpIds.includes(id));
    if (allSelected) {
      setSelectedEmpIds((prev) => prev.filter((id) => !drIds.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...drIds])));
    }
  };

  // Determine effective proposed coach ID based on coachMode
  let effectiveCoachId: number = currentEmployee.id;
  if (coachMode === 'HIGHER_MANAGER' && currentEmployee.managerId) {
    effectiveCoachId = currentEmployee.managerId;
  } else if (coachMode === 'SPECIALIST' && customCoachId) {
    effectiveCoachId = Number(customCoachId);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (selectedEmpIds.length === 0) {
      setFormError('Please select at least one employee to receive coaching.');
      return;
    }
    if (coachMode === 'SPECIALIST' && !customCoachId) {
      setFormError('Please select a designated Specialist Coach.');
      return;
    }
    if (!skillTitle.trim()) {
      setFormError('Please provide a skill title or focus area.');
      return;
    }
    if (!businessJustification.trim()) {
      setFormError('Please provide a business justification explaining why this skill development is needed.');
      return;
    }

    createMutation.mutate({
      targetEmployeeIds: selectedEmpIds,
      proposedCoachEmployeeId: effectiveCoachId,
      coachingFiscalQuarterId: activeQuarterId,
      skillTitle: skillTitle.trim(),
      businessJustification: businessJustification.trim(),
    });
  };

  // Combine direct reports with any additionally selected employees
  const selectedExtraEmployees = allActiveEmployees.filter(
    (emp) => selectedEmpIds.includes(emp.id) && !directReports.some((dr) => dr.id === emp.id)
  );

  const filteredSearchEmployees = searchTerm.trim()
    ? allActiveEmployees.filter(
        (emp) =>
          emp.id !== currentEmployee.id &&
          !directReports.some((dr) => dr.id === emp.id) &&
          (emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.departmentName && emp.departmentName.toLowerCase().includes(searchTerm.toLowerCase())))
      )
    : [];

  return (
    <div
      className="apid-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Request Skill-Development Coaching"
    >
      <div className="apid-card apid-modal" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <GraduationCap size={20} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Request Skill-Development Coaching
            </h3>
            <p className="boa-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem' }}>
              Nominate employees for targeted skill growth. The coach can be yourself (Line Manager), your Higher Manager, or a specialized coach. Submits to <strong>PMS Admin</strong> for approval.
            </p>
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            <X size={15} />
          </button>
        </div>

        {formError && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 6,
              color: '#dc2626',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="apid-form">
          {/* 1. Target Employees Selection */}
          <div className="apid-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>
                Target Employees to Learn Skill ({selectedEmpIds.length} selected)
              </label>
              {directReports.length > 0 && (
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={selectAllDirectReports}
                >
                  {directReports.every((dr) => selectedEmpIds.includes(dr.id))
                    ? 'Deselect All Direct Reports'
                    : 'Select All Direct Reports'}
                </button>
              )}
            </div>

            {/* Direct Reports List */}
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 6,
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                background: 'var(--surface-subtle, #f8fafc)',
              }}
            >
              <div className="boa-muted" style={{ fontSize: '0.74rem', paddingLeft: '0.4rem', fontWeight: 600 }}>
                DIRECT REPORTS:
              </div>
              {directReports.map((dr) => {
                const checked = selectedEmpIds.includes(dr.id);
                return (
                  <label
                    key={dr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 4,
                      backgroundColor: checked ? 'rgba(202, 138, 4, 0.12)' : 'transparent',
                      cursor: 'pointer',
                      border: checked ? '1px solid rgba(202, 138, 4, 0.35)' : '1px solid transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelectEmployee(dr.id)}
                    />
                    <div style={{ flex: 1, fontSize: '0.86rem' }}>
                      <strong>{dr.fullName}</strong>{' '}
                      <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                        ({dr.employeeNumber})
                      </span>
                      {dr.jobTitle && (
                        <span className="boa-muted" style={{ fontSize: '0.76rem', marginLeft: '0.5rem' }}>
                          — {dr.jobTitle}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}

              {/* Extra Selected Employees */}
              {selectedExtraEmployees.length > 0 && (
                <>
                  <div className="boa-muted" style={{ fontSize: '0.74rem', paddingLeft: '0.4rem', marginTop: '0.35rem', fontWeight: 600 }}>
                    ADDITIONAL SELECTED EMPLOYEES:
                  </div>
                  {selectedExtraEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.4rem 0.6rem',
                        borderRadius: 4,
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        cursor: 'pointer',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleSelectEmployee(emp.id)}
                      />
                      <div style={{ flex: 1, fontSize: '0.86rem' }}>
                        <strong>{emp.fullName}</strong>{' '}
                        <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                          ({emp.employeeNumber})
                        </span>
                        <span className="boa-muted" style={{ fontSize: '0.76rem', marginLeft: '0.5rem' }}>
                          — {emp.position || emp.job || emp.departmentName}
                        </span>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>

            {/* Expandable Search to add non-direct reports */}
            <div style={{ marginTop: '0.45rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
                <input
                  type="text"
                  className="apid-input"
                  style={{ paddingLeft: '2rem', fontSize: '0.82rem' }}
                  placeholder="Search other department or bank employees to add..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {filteredSearchEmployees.length > 0 && (
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    background: '#fff',
                    marginTop: '0.25rem',
                  }}
                >
                  {filteredSearchEmployees.slice(0, 8).map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => {
                        toggleSelectEmployee(emp.id);
                        setSearchTerm('');
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        <strong>{emp.fullName}</strong> ({emp.employeeNumber})
                      </span>
                      <span className="boa-muted">{emp.position || emp.job || emp.departmentName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Coach Selection Mode (Flexible Hierarchy) */}
          <div className="apid-field">
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Who Will Teach / Coach this Skill?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: currentEmployee.managerFullName ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
              {/* Option 1: Myself */}
              <button
                type="button"
                className={`apid-btn ${coachMode === 'SELF' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ textAlign: 'left', padding: '0.55rem 0.75rem', height: 'auto' }}
                onClick={() => setCoachMode('SELF')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Myself (Line Manager)</div>
                <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>{currentEmployee.fullName}</div>
              </button>

              {/* Option 2: Higher Manager (if available) */}
              {currentEmployee.managerFullName && (
                <button
                  type="button"
                  className={`apid-btn ${coachMode === 'HIGHER_MANAGER' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                  style={{ textAlign: 'left', padding: '0.55rem 0.75rem', height: 'auto' }}
                  onClick={() => setCoachMode('HIGHER_MANAGER')}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>My Higher Manager</div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>{currentEmployee.managerFullName}</div>
                </button>
              )}

              {/* Option 3: Specialist Coach */}
              <button
                type="button"
                className={`apid-btn ${coachMode === 'SPECIALIST' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ textAlign: 'left', padding: '0.55rem 0.75rem', height: 'auto' }}
                onClick={() => setCoachMode('SPECIALIST')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Specialist / Other Coach</div>
                <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>Designate Bank Colleague</div>
              </button>
            </div>

            {/* Specialist Coach dropdown when SPECIALIST is active */}
            {coachMode === 'SPECIALIST' && (
              <div style={{ marginTop: '0.5rem' }}>
                <label htmlFor="select-specialist-coach" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Select Designated Coach:
                </label>
                <select
                  id="select-specialist-coach"
                  className="apid-input"
                  value={customCoachId}
                  onChange={(e) => setCustomCoachId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">-- Choose Coach from Active Staff --</option>
                  {allActiveEmployees
                    .filter((emp) => emp.id !== currentEmployee.id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeNumber}) — {emp.position || emp.job || emp.departmentName}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="boa-muted" style={{ fontSize: '0.76rem', marginTop: '0.35rem' }}>
              Selected Proposed Coach: <strong>
                {coachMode === 'SELF'
                  ? `${currentEmployee.fullName} (Myself)`
                  : coachMode === 'HIGHER_MANAGER'
                  ? `${currentEmployee.managerFullName} (Higher Manager)`
                  : allActiveEmployees.find((e) => e.id === customCoachId)?.fullName ?? 'None selected'}
              </strong> (Subject to PMS Admin approval/override).
            </div>
          </div>

          {/* 3. Skill Title & Fiscal Quarter */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <div className="apid-field">
              <label htmlFor="skill-title" style={{ fontWeight: 600 }}>
                Skill Focus Title <span style={{ color: 'var(--err, #ef4444)' }}>*</span>
              </label>
              <input
                id="skill-title"
                type="text"
                className="apid-input"
                maxLength={200}
                placeholder="e.g. Trade Finance Compliance & Letter of Credit"
                value={skillTitle}
                onChange={(e) => setSkillTitle(e.target.value)}
                required
              />
            </div>
            <div className="apid-field">
              <label htmlFor="skill-quarter" style={{ fontWeight: 600 }}>
                Target Quarter
              </label>
              <input
                id="skill-quarter"
                type="text"
                className="apid-input"
                value={activeQuarterLabel}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* 4. Business Justification */}
          <div className="apid-field">
            <label htmlFor="skill-justification" style={{ fontWeight: 600 }}>
              Business Justification / Objective <span style={{ color: 'var(--err, #ef4444)' }}>*</span>
            </label>
            <textarea
              id="skill-justification"
              className="apid-input"
              rows={3}
              placeholder="Explain the capability gap, why this skill is needed, and expected performance outcome..."
              value={businessJustification}
              onChange={(e) => setBusinessJustification(e.target.value)}
              required
            />
          </div>

          {/* Modal Actions */}
          <div className="apid-modal-actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="apid-btn apid-btn-outline"
              disabled={createMutation.isPending}
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                'Submitting...'
              ) : (
                <>
                  <UserPlus size={14} style={{ marginRight: '0.35rem' }} />
                  Submit Request ({selectedEmpIds.length} staff)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
