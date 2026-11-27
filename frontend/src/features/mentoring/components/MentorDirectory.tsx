import { useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Eye, MapPin, Search, Star, Users } from 'lucide-react';
import { extractApiErrorMessage, type ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, Pagination, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import { mentorDirectoryApi, type MentorDirectoryItem } from '../api/mentorDirectoryApi';
import { MentorProfileModal } from './MentorProfileModal';
import { MentorProfilePhoto } from './MentorProfilePhoto';
import {
  filterByOrganizationLocation,
  OrganizationLocationFilter,
} from './OrganizationLocationFilter';
import './MentorDirectory.css';

const MENTORS_PER_PAGE = 8;

function normalizeProfileText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function MentorCard({
  mentor,
  currentUserId,
  requests,
  onViewProfile,
  onRequest,
}: {
  mentor: MentorDirectoryItem;
  currentUserId?: number;
  requests: MentoringPairing[];
  onViewProfile: () => void;
  onRequest: (skillId: number | null) => void;
}) {
  const activeRequests = requests.filter(
    (request) =>
      request.mentorUserId === mentor.userId &&
      request.traineeUserId === currentUserId &&
      (request.status === 'PENDING' || request.status === 'ACCEPTED')
  );
  const availableSkills = mentor.skills.filter(
    (skill) => !activeRequests.some((request) => request.skillId === skill.id)
  );
  const generalRequest = activeRequests.some((request) => request.skillId === null);
  const hasRequestablePairing = mentor.skills.length === 0
    ? !generalRequest
    : availableSkills.length > 0 || !generalRequest;
  const hasExistingRequest = activeRequests.length > 0;
  const buttonLabel = !hasRequestablePairing
    ? activeRequests.some((request) => request.status === 'PENDING')
      ? 'Request pending'
      : 'Mentorship active'
    : hasExistingRequest
      ? availableSkills.length > 0
        ? 'Request another skill'
        : 'Send another request'
      : 'Request mentorship';
  const rating = mentor.averageRating;
  const approach = mentor.mentoringApproach || mentor.bio;
  const matchesSkills = approach && normalizeProfileText(approach) === normalizeProfileText(
    mentor.skills.map((skill) => skill.name).join(', ')
  );
  const location = mentor.organizationPath?.map((item) => item.name).join(' / ')
    || mentor.departmentName
    || 'Location not provided';

  return (
    <article className="mentor-directory-card">
      <div className="mentor-directory-card-header">
        <MentorProfilePhoto mentor={mentor} />
        <div className="mentor-directory-rating">
          <Star size={16} aria-hidden="true" fill={rating != null ? 'currentColor' : 'none'} />
          {rating != null ? rating.toFixed(1) : 'Not rated'}
        </div>
      </div>

      <div className="mentor-directory-card-content">
        <div>
          <h4>{mentor.fullName}</h4>
          <p className="mentor-directory-location">
            <MapPin size={14} aria-hidden="true" />
            <span>{location}</span>
          </p>
        </div>

        <div className="mentor-directory-card-facts">
          <span>
            <BriefcaseBusiness size={14} aria-hidden="true" />
            {mentor.experienceYears == null
              ? 'Experience not provided'
              : `${mentor.experienceYears} year${mentor.experienceYears === 1 ? '' : 's'} experience`}
          </span>
          <span>
            <Users size={14} aria-hidden="true" />
            {mentor.remainingCapacity} available slot{mentor.remainingCapacity === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mentor-directory-card-skills" aria-label={`Skills for ${mentor.fullName}`}>
          {mentor.skills.length > 0 ? mentor.skills.slice(0, 4).map((skill) => (
            <StatusPill key={skill.id} label={skill.name} tone="neutral" />
          )) : <span className="boa-muted">No skills linked</span>}
          {mentor.skills.length > 4 && (
            <span className="boa-muted" title={mentor.skills.slice(4).map((skill) => skill.name).join(', ')}>
              +{mentor.skills.length - 4}
            </span>
          )}
        </div>

        <p className="mentor-directory-approach">
          {approach && !matchesSkills ? approach : 'View profile for more about this mentor.'}
        </p>
        {mentor.sessionsPerWeek != null && (
          <p className="mentor-directory-weekly-sessions">
            {mentor.sessionsPerWeek} sessions per week
          </p>
        )}
      </div>

      <div className="mentor-directory-card-actions">
        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          aria-label={`View profile for ${mentor.fullName}`}
          onClick={onViewProfile}
        >
          <Eye size={14} /> View profile
        </button>
        {currentUserId && (
          <button
            type="button"
            className="apid-btn apid-btn-primary apid-btn-sm"
            disabled={!hasRequestablePairing || mentor.remainingCapacity === 0}
            onClick={() => onRequest(availableSkills[0]?.id ?? null)}
          >
            {mentor.remainingCapacity === 0 ? 'At capacity' : buttonLabel}
          </button>
        )}
      </div>
    </article>
  );
}

export function MentorDirectory({
  mentors,
  currentUserId,
  currentUserOrganizationPath = [],
  requests = [],
}: {
  mentors: MentorDirectoryItem[];
  currentUserId?: number;
  currentUserOrganizationPath?: MentorDirectoryItem['organizationPath'];
  requests?: MentoringPairing[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [viewMode, setViewMode] = useState<'TOP_RATED' | 'ALL'>('TOP_RATED');
  const [nameFilter, setNameFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedMentor, setSelectedMentor] = useState<MentorDirectoryItem | null>(null);
  const [profileMentor, setProfileMentor] = useState<MentorDirectoryItem | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [message, setMessage] = useState('');
  const otherMentors = useMemo(
    () => mentors.filter((mentor) => mentor.userId !== currentUserId),
    [mentors, currentUserId]
  );
  const locationPaths = [
    ...otherMentors.map((mentor) => mentor.organizationPath ?? []),
    currentUserOrganizationPath,
  ];
  const locatedMentors = filterByOrganizationLocation(otherMentors, selectedLocationId);
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

  const filteredMentors = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    const results = locatedMentors.filter(
      (mentor) =>
        (!name || mentor.fullName.toLowerCase().includes(name)) &&
        (skillFilter === 'ALL' || mentor.skills.some((skill) => String(skill.id) === skillFilter)) &&
        (!availableOnly || mentor.remainingCapacity > 0)
    );
    results.sort((first, second) =>
      first.fullName.localeCompare(second.fullName, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) || first.userId - second.userId
    );
    return viewMode === 'TOP_RATED'
      ? results.filter((mentor) => mentor.averageRating != null && mentor.averageRating > 0)
      : results;
  }, [
    availableOnly,
    locatedMentors,
    nameFilter,
    skillFilter,
    viewMode,
  ]);
  const totalPages = Math.ceil(filteredMentors.length / MENTORS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const visibleMentors = filteredMentors.slice(
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
  const profileQuery = useQuery({
    queryKey: ['mentoring', 'directory-profile', profileMentor?.userId],
    queryFn: () => {
      if (!profileMentor) throw new Error('Select a mentor to view their profile.');
      return mentorDirectoryApi.getMentorProfile(profileMentor.userId);
    },
    enabled: profileMentor !== null,
  });

  return (
    <section className="apid-card mentor-directory">
      <div className="boa-card-header mentor-directory-header">
        <div>
          <h3 className="boa-card-title">Mentor Directory</h3>
          <p className="boa-card-subtitle">
            Discover mentors by rating, skills, and location, then request mentorship directly.
          </p>
        </div>
        <div className="mentor-directory-view-switch" role="group" aria-label="Mentor directory view">
          <button
            type="button"
            className={viewMode === 'TOP_RATED' ? 'is-selected' : ''}
            aria-pressed={viewMode === 'TOP_RATED'}
            onClick={() => {
              setViewMode('TOP_RATED');
              setPage(0);
            }}
          >
            Top rated
          </button>
          <button
            type="button"
            className={viewMode === 'ALL' ? 'is-selected' : ''}
            aria-pressed={viewMode === 'ALL'}
            onClick={() => {
              setViewMode('ALL');
              setPage(0);
            }}
          >
            All mentors
          </button>
        </div>
      </div>

      <div className="mentor-directory-filters">
        <label className="mentor-directory-search">
          <span>Name</span>
          <span className="mentor-directory-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              className="apid-input"
              aria-label="Search mentors by name"
              placeholder="Search by name"
              value={nameFilter}
              onChange={(event) => {
                setNameFilter(event.target.value);
                setPage(0);
              }}
            />
          </span>
        </label>
        <OrganizationLocationFilter
          paths={locationPaths}
          value={selectedLocationId}
          onChange={(value) => {
            setSelectedLocationId(value);
            setPage(0);
          }}
        />
        <label className="mentor-directory-filter-field">
          Skill
          <select
            className="apid-input"
            aria-label="Filter mentors by skill"
            value={skillFilter}
            onChange={(event) => {
              setSkillFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="ALL">All skills</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>{skill.name}</option>
            ))}
          </select>
        </label>
        <label className="mentor-directory-available-filter">
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

      <div className="mentor-directory-results-header">
        <p className="boa-muted">
          {viewMode === 'TOP_RATED'
            ? `Showing ${visibleMentors.length} of ${filteredMentors.length} highest-rated mentors`
            : `${filteredMentors.length} mentor${filteredMentors.length === 1 ? '' : 's'} found`}
        </p>
        <span className="mentor-directory-live-badge">Live directory</span>
      </div>

      {visibleMentors.length === 0 ? (
        <EmptyState
          title={
            onlyOwnMentorProfile
              ? 'No Other Mentors Found'
              : otherMentors.length === 0
                ? 'No Mentors Found'
                : viewMode === 'TOP_RATED' && !nameFilter && skillFilter === 'ALL' &&
                  !selectedLocationId && !availableOnly
                  ? 'No Rated Mentors Yet'
                  : 'No Matching Mentors'
          }
          description={
            onlyOwnMentorProfile
              ? 'Your own profile is hidden from the mentor directory.'
              : otherMentors.length === 0
                ? 'There are no active mentors available right now.'
                : viewMode === 'TOP_RATED'
                  ? 'No mentors match these filters with a rating yet. Switch to All mentors to browse the full directory.'
                  : 'No mentors match the selected filters. Try changing your search or filters.'
          }
        />
      ) : (
        <div className="mentor-directory-grid">
          {visibleMentors.map((mentor) => (
            <MentorCard
              key={mentor.userId}
              mentor={mentor}
              currentUserId={currentUserId}
              requests={requests}
              onViewProfile={() => setProfileMentor(mentor)}
              onRequest={(skillId) => {
                setSelectedMentor(mentor);
                setSelectedSkillId(skillId == null ? '' : String(skillId));
                setMessage('');
              }}
            />
          ))}
        </div>
      )}
      {visibleMentors.length > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalElements={filteredMentors.length}
          itemLabel="mentors"
          onPageChange={setPage}
        />
      )}

      {profileMentor && (
        <MentorProfileModal
          mentor={profileQuery.data?.mentor ?? profileMentor}
          profileSummary={profileQuery.data?.profileSummary}
          careerExperience={profileQuery.data?.careerExperience}
          mentorshipExperience={profileQuery.data?.mentorshipExperience}
          loading={profileQuery.isPending}
          error={profileQuery.error
            ? extractApiErrorMessage(profileQuery.error, 'Could not load additional profile details.')
            : null}
          onClose={() => setProfileMentor(null)}
        />
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
    </section>
  );
}
