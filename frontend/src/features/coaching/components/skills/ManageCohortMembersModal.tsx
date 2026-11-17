import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  skillCoachingRequestApi,
  SkillCoachingRequestItem,
  SkillCoachingTargetItem,
} from '../../api/skillCoachingRequestApi';
import { useToast } from '../../../../shared/components/ui';
import type { EmployeeItem } from '../../../admin/organization/types/organization.types';

interface ManageCohortMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohort: SkillCoachingRequestItem | null;
  currentEmployee?: any;
}

export const ManageCohortMembersModal: React.FC<ManageCohortMembersModalProps> = ({
  isOpen,
  onClose,
  cohort,
}) => {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch only eligible direct reports under this coach
  const eligibleMembersQuery = useQuery<EmployeeItem[]>({
    queryKey: ['coaching', 'eligible-cohort-members', cohort?.id],
    queryFn: () => {
      if (!cohort) return Promise.resolve([]);
      return skillCoachingRequestApi.getEligibleCohortMembers(cohort.id);
    },
    enabled: isOpen && !!cohort?.id,
    staleTime: 30_000,
  });

  const directReports = eligibleMembersQuery.data ?? [];

  // Invalidate queries helper
  const invalidateCohortData = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-approved-skill-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'my-skill-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'skill-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'eligible-cohort-members', cohort?.id] });
    void queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['coaching-assignments'] });
  };

  // Add Member Mutation
  const addMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      if (!cohort) throw new Error('No cohort selected');
      return skillCoachingRequestApi.addCohortMember(cohort.id, employeeId);
    },
    onSuccess: () => {
      pushToast({
        title: 'Member Added to Cohort',
        message: 'Direct report added successfully. Coaching assignment and upcoming sessions synced.',
        tone: 'ok',
      });
      setSelectedEmpId(null);
      setSearchTerm('');
      setErrorMessage(null);
      invalidateCohortData();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to add member to cohort.';
      setErrorMessage(msg);
      pushToast({
        title: 'Could Not Add Member',
        message: msg,
        tone: 'err',
      });
    },
  });

  // Remove Member Mutation
  const removeMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      if (!cohort) throw new Error('No cohort selected');
      return skillCoachingRequestApi.removeCohortMember(cohort.id, employeeId);
    },
    onSuccess: () => {
      pushToast({
        title: 'Member Removed',
        message: 'Employee removed from cohort and upcoming sessions.',
        tone: 'ok',
      });
      setErrorMessage(null);
      invalidateCohortData();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Cannot remove member. They may have already attended sessions.';
      setErrorMessage(msg);
      pushToast({
        title: 'Removal Failed',
        message: msg,
        tone: 'err',
      });
    },
  });

  if (!isOpen || !cohort) return null;

  // Filter direct reports by search input
  const candidateEmployees = directReports.filter(
    (emp) =>
      searchTerm.trim() === '' ||
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.departmentName && emp.departmentName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedEmp = directReports.find((e) => e.id === selectedEmpId);
  const currentMembersCount = cohort.targets?.length || 0;
  const isFull = currentMembersCount >= 10;
  const coachName = cohort.proposedCoachFullName || 'Designated Coach';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          backgroundColor: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(202, 138, 4, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(2, 132, 199, 0.15)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Manage Cohort Members
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.12)',
                    color: '#0284c7',
                  }}
                >
                  Cohort #{cohort.id}
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                {cohort.skillTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-ghost"
            style={{ padding: '0.35rem', borderRadius: '50%', color: 'var(--muted)' }}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Current Members Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Current Enrolled Coachees ({currentMembersCount} / 10)
              </span>
              <span style={{ fontSize: '0.75rem', color: isFull ? '#dc2626' : 'var(--muted)', fontWeight: isFull ? 600 : 400 }}>
                {isFull ? 'Cohort at maximum capacity' : `${10 - currentMembersCount} slots remaining`}
              </span>
            </div>

            {cohort.targets && cohort.targets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cohort.targets.map((member: SkillCoachingTargetItem) => {
                  const isRemoving = removeMutation.isPending && removeMutation.variables === member.employeeId;
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'var(--surface-subtle, #f8fafc)',
                        border: '1px solid var(--border, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(2, 132, 199, 0.12)',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {member.employeeFullName
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                            {member.employeeFullName}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                            ID: {member.employeeNumber} {member.position ? `· ${member.position}` : ''}{' '}
                            {member.department ? `· ${member.department}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="apid-btn"
                        style={{
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.74rem',
                          borderRadius: '6px',
                          color: '#dc2626',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fee2e2',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: isRemoving ? 'not-allowed' : 'pointer',
                        }}
                        disabled={isRemoving}
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove ${member.employeeFullName} from this cohort?`)) {
                            removeMutation.mutate(member.employeeId);
                          }
                        }}
                        title="Remove member (only allowed if no sessions have been attended)"
                      >
                        {isRemoving ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: 'var(--surface-subtle, #f8fafc)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border, #cbd5e1)',
                  color: 'var(--muted)',
                  fontSize: '0.82rem',
                }}
              >
                No members currently enrolled in this cohort.
              </div>
            )}
          </div>

          {/* Add New Member Section (Restricted to Coach's Direct Reports) */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--border, #e2e8f0)',
              backgroundColor: 'var(--surface-subtle, #fbfcfd)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <UserPlus size={16} color="#0284c7" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Add Direct Report to Cohort
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 1.55rem', fontSize: '0.74rem', color: 'var(--muted)' }}>
                Showing direct employees reporting to Coach <strong>{coachName}</strong>. Members from other departments or managers cannot be added.
              </p>
            </div>

            {isFull ? (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={15} />
                <span>Maximum cohort capacity of 10 participants reached.</span>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search direct reports under ${coachName}...`}
                    className="apid-input"
                    style={{ paddingLeft: '2.2rem', fontSize: '0.8rem', width: '100%' }}
                  />
                </div>

                {/* Candidate Selection List */}
                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {eligibleMembersQuery.isLoading ? (
                    <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Loader2 size={14} className="spin" />
                      Loading direct reports under coach...
                    </div>
                  ) : candidateEmployees.length === 0 ? (
                    <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {searchTerm
                        ? 'No matching direct reports found'
                        : `No eligible direct reports available. All direct staff under ${coachName} are already enrolled in this cohort.`}
                    </div>
                  ) : (
                    candidateEmployees.map((candidate) => {
                      const isSelected = selectedEmpId === candidate.id;
                      return (
                        <div
                          key={candidate.id}
                          onClick={() => setSelectedEmpId(candidate.id)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                            borderBottom: '1px solid var(--border, #f1f5f9)',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {candidate.fullName}
                            </span>{' '}
                            <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                              ({candidate.employeeNumber}) · {candidate.position || candidate.departmentName || 'Branch Staff'}
                            </span>
                          </div>
                          {isSelected && <CheckCircle size={14} color="#0284c7" />}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Member Preview & Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                    {selectedEmp ? (
                      <span>
                        Selected: <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.fullName}</strong>
                      </span>
                    ) : (
                      'Select a direct report from the list above'
                    )}
                  </div>
                  <button
                    type="button"
                    className="apid-btn apid-btn-primary"
                    disabled={!selectedEmpId || addMutation.isPending}
                    onClick={() => {
                      if (selectedEmpId) addMutation.mutate(selectedEmpId);
                    }}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    {addMutation.isPending ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />}
                    Add to Cohort
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                    fontSize: '0.73rem',
                    color: 'var(--muted)',
                    background: 'rgba(2, 132, 199, 0.04)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                  }}
                >
                  <Info size={13} color="#0284c7" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <span>
                    Only direct reports under Coach {coachName} are eligible. Adding a member immediately provisions their self-development assignment and links them to all upcoming cohort workshops.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <button
            type="button"
            className="apid-btn apid-btn-outline"
            onClick={onClose}
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
