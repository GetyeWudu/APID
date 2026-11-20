import { useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, X } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  DataSourceBadge,
  DataTable,
  EmptyState,
  Pagination,
  StatusPill,
  useToast,
  type DataTableColumn,
} from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import type { MentorDirectoryItem } from '../api/mentorDirectoryApi';
import './MentorDirectory.css';

const MENTORS_PER_PAGE = 10;

function normalizeProfileText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

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
  const [page, setPage] = useState(0);
  const [selectedMentor, setSelectedMentor] = useState<MentorDirectoryItem | null>(null);
  const [profileMentor, setProfileMentor] = useState<MentorDirectoryItem | null>(null);
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
  const totalPages = Math.ceil(filteredMentors.length / MENTORS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const paginatedMentors = filteredMentors.slice(
    currentPage * MENTORS_PER_PAGE,
    (currentPage + 1) * MENTORS_PER_PAGE
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
  const profileSkillsSummary = profileMentor?.skills.map((skill) => skill.name).join(', ') ?? '';
  const profileApproach = profileMentor?.mentoringApproach?.trim() || '';
  const profileBio = profileMentor?.bio?.trim() || '';
  const showProfileApproach = Boolean(profileApproach)
    && normalizeProfileText(profileApproach) !== normalizeProfileText(profileSkillsSummary);
  const showProfileBio = Boolean(profileBio)
    && ![profileSkillsSummary, profileApproach].some((value) =>
      value && normalizeProfileText(profileBio) === normalizeProfileText(value)
    );
  const columns: DataTableColumn<MentorDirectoryItem>[] = [
    {
      key: 'mentor',
      header: 'Mentor',
      render: (mentor) => (
        <div className="boa-stack" style={{ gap: '0.15rem' }}>
          <strong>{mentor.fullName}</strong>
          <span className="boa-muted" style={{ fontSize: '0.75rem' }}>
            {[mentor.employeeNumber, mentor.departmentName].filter(Boolean).join(' · ') || mentor.username}
          </span>
        </div>
      ),
    },
    {
      key: 'skills',
      header: 'Skills',
      render: (mentor) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
          {mentor.skills.length > 0 ? (
            <>
              {mentor.skills.slice(0, 4).map((skill) => (
                <StatusPill key={skill.id} label={skill.name} tone="neutral" />
              ))}
              {mentor.skills.length > 4 && (
                <span
                  className="boa-muted"
                  title={mentor.skills.slice(4).map((skill) => skill.name).join(', ')}
                >
                  +{mentor.skills.length - 4} more
                </span>
              )}
            </>
          ) : (
            <span className="boa-muted">No skills linked</span>
          )}
        </div>
      ),
    },
    {
      key: 'experience',
      header: 'Experience',
      render: (mentor) => mentor.experienceYears == null
        ? <span className="boa-muted">Not provided</span>
        : `${mentor.experienceYears} year${mentor.experienceYears === 1 ? '' : 's'}`,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (mentor) => {
        return (
          <div className="mentor-directory-capacity">
            <strong>
              {mentor.remainingCapacity === undefined
                ? 'Capacity not available'
                : `${mentor.remainingCapacity} slot${mentor.remainingCapacity === 1 ? '' : 's'}`}
            </strong>
            {mentor.sessionsPerWeek != null && (
              <span>{mentor.sessionsPerWeek} sessions/week</span>
            )}
            {mentor.sessionsPerWeek == null && <span className="boa-muted">Weekly sessions not provided</span>}
          </div>
        );
      },
    },
    {
      key: 'approach',
      header: 'Mentoring approach',
      render: (mentor) => {
        const approach = mentor.mentoringApproach || mentor.bio;
        const matchesSkills = approach && normalizeProfileText(approach) === normalizeProfileText(
          mentor.skills.map((skill) => skill.name).join(', ')
        );
        return approach && !matchesSkills
          ? <span title={approach}>{approach}</span>
          : <span className="boa-muted">View profile for details</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (mentor: MentorDirectoryItem) => {
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
          <div className="mentor-directory-actions">
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              aria-label={`View profile for ${mentor.fullName}`}
              onClick={() => setProfileMentor(mentor)}
            >
              <Eye size={14} /> View
            </button>
            {currentUserId && (
              <button
                type="button"
                className="apid-btn apid-btn-primary apid-btn-sm"
                disabled={!hasRequestablePairing || mentor.remainingCapacity === 0}
                onClick={() => {
                  setSelectedMentor(mentor);
                  setSelectedSkillId(availableSkills[0] ? String(availableSkills[0].id) : '');
                  setMessage('');
                }}
              >
                {mentor.remainingCapacity === 0 ? 'At capacity' : buttonLabel}
              </button>
            )}
          </div>
        );
      },
    },
  ];

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
              onChange={(event) => {
                setSkillFilter(event.target.value);
                setPage(0);
              }}
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
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(0);
              }}
            />
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(event) => {
                  setAvailableOnly(event.target.checked);
                  setPage(0);
                }}
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
        <>
          <div className="mentor-directory-table">
            <DataTable
              columns={columns}
              rows={paginatedMentors}
              rowKey={(mentor) => mentor.userId}
            />
          </div>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalElements={filteredMentors.length}
            itemLabel="mentors"
            onPageChange={setPage}
          />
        </>
      )}
      {profileMentor && (
        <div
          className="apid-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileMentor(null);
          }}
        >
          <div
            className="apid-card apid-modal mentor-directory-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Mentor profile for ${profileMentor.fullName}`}
          >
            <header className="mentor-directory-profile-header">
              <div>
                <span>Mentor profile</span>
                <h3>{profileMentor.fullName}</h3>
                <p>
                  {[profileMentor.employeeNumber, profileMentor.departmentName]
                    .filter(Boolean).join(' · ') || profileMentor.username}
                </p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                aria-label="Close mentor profile"
                onClick={() => setProfileMentor(null)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="mentor-directory-profile-facts">
              <div><span>Experience</span><strong>
                {profileMentor.experienceYears == null
                  ? 'Not provided'
                  : `${profileMentor.experienceYears} year${profileMentor.experienceYears === 1 ? '' : 's'}`}
              </strong></div>
              <div><span>Open capacity</span><strong>
                {profileMentor.remainingCapacity} open slot{profileMentor.remainingCapacity === 1 ? '' : 's'}
              </strong></div>
              <div><span>Sessions per week</span><strong>
                {profileMentor.sessionsPerWeek ?? 'Not provided'}
              </strong></div>
              <div><span>Average rating</span><strong>
                {profileMentor.averageRating != null && profileMentor.averageRating > 0
                  ? profileMentor.averageRating.toFixed(1)
                  : 'Not rated yet'}
              </strong></div>
            </div>
            <section className="mentor-directory-profile-section">
              <h4>Skills</h4>
              {profileMentor.skills.length > 0 ? (
                <div className="mentor-directory-profile-skills">
                  {profileMentor.skills.map((skill) => (
                    <StatusPill key={skill.id} label={skill.name} tone="neutral" />
                  ))}
                </div>
              ) : <p className="boa-muted">No skills linked.</p>}
            </section>
            <section className="mentor-directory-profile-section">
              <h4>Education</h4>
              {profileMentor.education?.length ? (
                profileMentor.education.map((education, index) => (
                  <article className="mentor-directory-profile-record" key={`education-${index}`}>
                    <strong>{education.educationLevel || 'Education'}</strong>
                    <span>
                      {[education.fieldOfStudy, education.institution].filter(Boolean).join(' · ')
                        || 'Additional details not provided'}
                    </span>
                  </article>
                ))
              ) : <p>No education details provided.</p>}
            </section>
            <section className="mentor-directory-profile-section">
              <h4>Professional certificates</h4>
              {profileMentor.professionalCertificates?.length ? (
                profileMentor.professionalCertificates.map((certificate, index) => (
                  <article className="mentor-directory-profile-record" key={`certificate-${index}`}>
                    <strong>{certificate.title || 'Certificate'}</strong>
                    {certificate.skills?.length ? (
                      <span>Related skills: {certificate.skills.join(', ')}</span>
                    ) : null}
                  </article>
                ))
              ) : <p>No professional certificates provided.</p>}
            </section>
            {showProfileApproach && (
              <section className="mentor-directory-profile-section">
                <h4>Mentoring approach</h4>
                <p>{profileApproach}</p>
              </section>
            )}
            {showProfileBio && (
              <section className="mentor-directory-profile-section">
                <h4>About</h4>
                <p>{profileBio}</p>
              </section>
            )}
            <div className="apid-modal-actions">
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => setProfileMentor(null)}
              >
                Close
              </button>
            </div>
          </div>
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
