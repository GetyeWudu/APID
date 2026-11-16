import { useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { DataSourceBadge, EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import type { MentorDirectoryItem } from '../api/mentorDirectoryApi';

export function MentorDirectory({
  mentors,
  currentUserId,
  requests = [],
}: {
  mentors: MentorDirectoryItem[];
  currentUserId?: number;
  requests?: MentoringPairing[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selectedMentor, setSelectedMentor] = useState<MentorDirectoryItem | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [message, setMessage] = useState('');
  const otherMentors = useMemo(
    () => mentors.filter((mentor) => mentor.userId !== currentUserId),
    [mentors, currentUserId]
  );
  const requestMutation = useMutation({
    mutationFn: mentoringPairingApi.requestMentor,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] }),
      ]);
      setSelectedMentor(null);
      setMessage('');
      setSelectedSkillId('');
      pushToast({
        title: 'Mentorship request sent',
        message: 'The mentor will be notified and can approve or decline your request.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to send the mentorship request.';
      pushToast({ title: 'Request failed', message: errorMessage, tone: 'err' });
    },
  });

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMentor) return;
    requestMutation.mutate({
      mentorUserId: selectedMentor.userId,
      skillId: selectedSkillId ? Number(selectedSkillId) : undefined,
      message: message.trim() || undefined,
    });
  };

  const skills = useMemo(() => {
    const byId = new Map<number, MentorDirectoryItem['skills'][number]>();
    otherMentors.forEach((mentor) => mentor.skills.forEach((skill) => byId.set(skill.id, skill)));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [otherMentors]);

  const filteredMentors = otherMentors.filter(
    (mentor) =>
      (skillFilter === 'ALL' || mentor.skills.some((skill) => String(skill.id) === skillFilter)) &&
      (!departmentFilter.trim() ||
        mentor.departmentName?.toLowerCase().includes(departmentFilter.trim().toLowerCase())) &&
      (!availableOnly || mentor.remainingCapacity === undefined || mentor.remainingCapacity > 0)
  );
  const onlyOwnMentorProfile = mentors.length > 0 && otherMentors.length === 0;
  const selectedSkillValue = selectedSkillId ? Number(selectedSkillId) : null;
  const selectedMentorRequest = selectedMentor
    ? requests.find(
        (request) =>
          request.mentorUserId === selectedMentor.userId &&
          request.traineeUserId === currentUserId &&
          request.skillId === selectedSkillValue &&
          (request.status === 'PENDING' || request.status === 'ACCEPTED')
      )
    : undefined;
  const selectedGeneralRequest = selectedMentor
    ? requests.find(
        (request) =>
          request.mentorUserId === selectedMentor.userId &&
          request.traineeUserId === currentUserId &&
          request.skillId === null &&
          (request.status === 'PENDING' || request.status === 'ACCEPTED')
      )
    : undefined;

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Mentor Directory</h3>
          <p className="boa-card-subtitle">Browse mentors by skill or department and send a direct mentorship request.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="boa-stack" style={{ gap: '0.35rem' }}>
            <select
              className="apid-input"
              aria-label="Filter mentors by skill"
              value={skillFilter}
              onChange={(event) => setSkillFilter(event.target.value)}
            >
              <option value="ALL">All Skills</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
            <input
              className="apid-input"
              aria-label="Filter mentors by department"
              placeholder="Department"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            />
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(event) => setAvailableOnly(event.target.checked)}
              />
              Available capacity only
            </label>
          </div>
          <DataSourceBadge source="live" />
        </div>
      </div>

      {filteredMentors.length === 0 ? (
        <EmptyState
          title={
            onlyOwnMentorProfile
              ? 'No Other Mentors Found'
              : otherMentors.length === 0
                ? 'No Mentors Found'
                : 'No Mentors for This Skill'
          }
          description={
            onlyOwnMentorProfile
              ? 'Your own profile is hidden from the mentor directory.'
              : otherMentors.length === 0
              ? 'There are no active mentors available right now.'
              : 'No mentors have this skill linked yet. Choose another skill or view all mentors.'
          }
        />
      ) : (
        <div className="boa-grid-2" style={{ marginBottom: 0 }}>
          {filteredMentors.map((mentor) => {
            const mentorRequests = requests.filter(
              (request) =>
                request.mentorUserId === mentor.userId &&
                request.traineeUserId === currentUserId &&
                (request.status === 'PENDING' || request.status === 'ACCEPTED')
            );
            const availableSkills = mentor.skills.filter(
              (skill) => !mentorRequests.some((request) => request.skillId === skill.id)
            );
            const generalRequest = mentorRequests.find((request) => request.skillId === null);
            const hasRequestablePairing = mentor.skills.length === 0
              ? !generalRequest
              : availableSkills.length > 0 || !generalRequest;
            const hasExistingRequest = mentorRequests.length > 0;
            const buttonLabel = !hasRequestablePairing
              ? mentorRequests.some((request) => request.status === 'PENDING')
                ? 'Request pending'
                : 'Mentorship active'
              : hasExistingRequest
                ? availableSkills.length > 0
                  ? 'Request another skill'
                  : 'Send another request'
                : 'Request mentorship';

            return (
              <article
                key={mentor.userId}
                className="apid-card"
                style={{ border: '1px solid var(--border)', marginBottom: 0 }}
              >
                <div style={{ fontWeight: 700 }}>{mentor.fullName}</div>
                <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                  {[mentor.employeeNumber, mentor.departmentName].filter(Boolean).join(' · ') || mentor.username}
                </div>
                <div className="boa-muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                  {mentor.remainingCapacity === undefined
                    ? 'Capacity not available'
                    : `${mentor.remainingCapacity} trainee slot${mentor.remainingCapacity === 1 ? '' : 's'} available`}
                  {mentor.availabilityNotes ? ` · ${mentor.availabilityNotes}` : ''}
                </div>
                {mentor.bio && <p className="boa-muted" style={{ fontSize: '0.84rem' }}>{mentor.bio}</p>}
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                  {mentor.skills.length > 0 ? (
                    mentor.skills.map((skill) => (
                      <StatusPill key={skill.id} label={skill.name} tone="neutral" />
                    ))
                  ) : (
                    <span className="boa-muted" style={{ fontSize: '0.8rem' }}>
                      No skills linked yet
                    </span>
                  )}
                </div>
                {currentUserId && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-primary apid-btn-sm"
                    style={{ marginTop: '0.75rem' }}
                    disabled={!hasRequestablePairing || mentor.remainingCapacity === 0}
                    onClick={() => {
                      setSelectedMentor(mentor);
                      setSelectedSkillId(
                        availableSkills[0] ? String(availableSkills[0].id) : ''
                      );
                      setMessage('');
                    }}
                  >
                    {mentor.remainingCapacity === 0 ? 'At capacity' : buttonLabel}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {selectedMentor && (
        <div className="apid-modal-backdrop">
          <div
            className="apid-card apid-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Request mentorship from ${selectedMentor.fullName}`}
          >
            <h3 style={{ marginTop: 0 }}>Request Mentorship</h3>
            <p className="boa-muted" style={{ fontSize: '0.85rem' }}>
              Send a one-to-one request to {selectedMentor.fullName}. They will approve or decline it.
            </p>
            <form className="apid-form" onSubmit={submitRequest}>
              {selectedMentor.skills.length > 0 && (
                <div className="apid-field">
                  <label htmlFor="mentorship-request-skill">Skill</label>
                  <select
                    id="mentorship-request-skill"
                    className="apid-input"
                    value={selectedSkillId}
                    onChange={(event) => setSelectedSkillId(event.target.value)}
                    disabled={requestMutation.isPending}
                  >
                    <option value="" disabled={Boolean(selectedGeneralRequest)}>
                      General mentorship
                    </option>
                    {selectedMentor.skills.map((skill) => {
                      const existing = requests.find(
                        (request) =>
                          request.mentorUserId === selectedMentor.userId &&
                          request.traineeUserId === currentUserId &&
                          request.skillId === skill.id &&
                          (request.status === 'PENDING' || request.status === 'ACCEPTED')
                      );
                      return (
                        <option key={skill.id} value={skill.id} disabled={Boolean(existing)}>
                          {skill.name}
                          {existing ? ` · ${existing.status === 'ACCEPTED' ? 'Mentorship active' : 'Request pending'}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div className="apid-field">
                <label htmlFor="mentorship-request-message">Message (optional)</label>
                <textarea
                  id="mentorship-request-message"
                  className="apid-input"
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={requestMutation.isPending}
                  placeholder="What would you like to learn?"
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={requestMutation.isPending}
                  onClick={() => setSelectedMentor(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={
                    requestMutation.isPending ||
                    selectedMentor.remainingCapacity === 0 ||
                    Boolean(selectedMentorRequest)
                  }
                >
                  {requestMutation.isPending ? 'Sending...' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
