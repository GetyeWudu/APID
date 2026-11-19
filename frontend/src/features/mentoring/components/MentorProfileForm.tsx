import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  HeartHandshake,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import './MentorProfileForm.css';

type ProfileRecord = Record<string, unknown>;
type AvailabilityDay = { day: string; start: string; end: string };
type ProfileAvailability = {
  days: AvailabilityDay[];
  timeZone: string;
  formats: string[];
};
type ProfileDraft = {
  education: ProfileRecord[];
  certificates: ProfileRecord[];
  mentorship: ProfileRecord[];
  career: ProfileRecord[];
  skills: string[];
  availability: ProfileAvailability;
  cv: string;
  motivationLetter: string;
};
type ProfileRecordSection = 'education' | 'certificates' | 'mentorship' | 'career';

const PROFILE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MENTORING_FORMATS = ['One-on-One Mentorship', 'Group Mentorship', 'Both'];
const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  education: [],
  certificates: [],
  mentorship: [],
  career: [],
  skills: [],
  availability: { days: [], timeZone: 'UTC', formats: [] },
  cv: '',
  motivationLetter: '',
};

function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to update your mentor profile.';
}

function parseNote(note: string | null | undefined) {
  const values: Record<string, string> = {};
  note?.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator > 0) values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  });
  return values;
}

function parseRecords(value: string | undefined): ProfileRecord[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((record): record is ProfileRecord =>
        Boolean(record) && typeof record === 'object' && !Array.isArray(record))
      : [];
  } catch {
    return [];
  }
}

function parseList(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
  } catch {
    // Older application notes store lists as comma-separated text.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseAvailability(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const availability = parsed as ProfileRecord;
    const days = Array.isArray(availability.days)
      ? availability.days.filter((entry): entry is ProfileRecord =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => ({
          day: typeof entry.day === 'string' ? entry.day : '',
          start: typeof entry.start === 'string' ? entry.start : '',
          end: typeof entry.end === 'string' ? entry.end : '',
        }))
        .filter((entry) => entry.day)
      : [];
    return {
      days,
      timeZone: typeof availability.timeZone === 'string' ? availability.timeZone : '',
      formats: Array.isArray(availability.formats)
        ? availability.formats.filter((format): format is string => typeof format === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function display(value: unknown, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function recordText(record: ProfileRecord, key: string) {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function safeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
}

export function MentorProfileForm({
  activeSkills,
  currentUserId,
}: {
  activeSkills: SkillItem[];
  currentUserId: number;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [capacity, setCapacity] = useState(3);
  const [changeNote, setChangeNote] = useState('');
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
  const [experienceYears, setExperienceYears] = useState('');
  const [mentoringApproach, setMentoringApproach] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('');
  const [otherSkills, setOtherSkills] = useState('');
  const [profileEvidence, setProfileEvidence] = useState<File[]>([]);
  const [isProfileUpdateModalOpen, setProfileUpdateModalOpen] = useState(false);
  const [badgeRemovalReason, setBadgeRemovalReason] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);

  const profileQuery = useQuery({
    queryKey: ['mentoring', 'trainer-profile'],
    queryFn: mentoringTrainerApi.getProfile,
  });
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'mine', currentUserId],
    queryFn: mentorApplicationApi.listMine,
  });
  const badgeRemovalQuery = useQuery({
    queryKey: ['mentoring', 'badge-removal-request', currentUserId],
    queryFn: mentoringTrainerApi.getMyBadgeRemovalRequest,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setCapacity(profile.maxConcurrentTrainees);
    setExperienceYears(profile.experienceYears?.toString() ?? '');
    setMentoringApproach(profile.mentoringApproach ?? profile.bio ?? '');
    setSessionsPerWeek(profile.sessionsPerWeek?.toString() ?? '');
    const applicationNote = parseNote(profile.profileApplicationDetails);
    const availability = parseAvailability(profile.availabilityNotes)
      ?? parseAvailability(applicationNote.Availability);
    const skillNames = [...new Set([
      ...parseList(applicationNote['Mentoring interests / expertise']),
      ...profile.skills.filter((skill) => skill.status === 'ACTIVE').map((skill) => skill.name),
    ])];
    const catalogNames = new Set(activeSkills.map((skill) => skill.name.toLowerCase()));
    setOtherSkills(skillNames
      .filter((name) => !catalogNames.has(name.toLowerCase()))
      .join(', '));
    setProfileDraft({
      education: parseRecords(applicationNote['Educational background']),
      certificates: parseRecords(applicationNote['Professional certificates']),
      mentorship: parseRecords(applicationNote['Previous mentorship experience']),
      career: parseRecords(applicationNote['General professional experience']),
      skills: skillNames,
      availability: availability ?? EMPTY_PROFILE_DRAFT.availability,
      cv: applicationNote.CV?.split(' (')[0] ?? '',
      motivationLetter: applicationNote['Letter of motivation']?.split(' (')[0] ?? '',
    });
  }, [activeSkills, profileQuery.data]);

  useEffect(() => {
    if (!isProfileUpdateModalOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileUpdateModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isProfileUpdateModalOpen]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const fileId = profileQuery.data?.profilePictureFileId;
    if (!fileId) {
      setProfilePictureUrl(null);
      return undefined;
    }
    void mentoringTrainerApi.downloadProfilePicture(fileId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setProfilePictureUrl(objectUrl);
    }).catch((error: unknown) => {
      if (active) {
        pushToast({ title: 'Unable to load profile picture', message: errorMessage(error), tone: 'err' });
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profileQuery.data?.profilePictureFileId, pushToast]);

  const refreshProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainer-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications', 'mine', currentUserId] }),
    ]);
  };

  const capacityMutation = useMutation({
    mutationFn: mentoringTrainerApi.updateProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(['mentoring', 'trainer-profile'], profile);
      await refreshProfile();
      pushToast({ title: 'Capacity updated', message: 'Your available trainee capacity is updated immediately.', tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to update capacity',
      message: errorMessage(error),
      tone: 'err',
    }),
  });

  const profileUpdateMutation = useMutation({
    mutationFn: mentorApplicationApi.requestProfileUpdate,
    onSuccess: async () => {
      await refreshProfile();
      setChangeNote('');
      setProfileEvidence([]);
      setProfileUpdateModalOpen(false);
      pushToast({
        title: 'Update request sent',
        message: 'Your complete profile and skill changes are awaiting HR review.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to request profile update',
      message: errorMessage(error),
      tone: 'err',
    }),
  });

  const badgeRemovalMutation = useMutation({
    mutationFn: mentoringTrainerApi.submitBadgeRemovalRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'badge-removal-request', currentUserId] });
      setBadgeRemovalReason('');
      pushToast({
        title: 'Request sent to HR',
        message: 'Your mentor badge remains unchanged until HR reviews your request.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to request badge removal',
      message: errorMessage(error),
      tone: 'err',
    }),
  });

  const profile = profileQuery.data;
  const applications = applicationsQuery.data ?? [];
  const pendingProfileUpdate = applications.find(
    (application) => application.applicationType === 'PROFILE_UPDATE' && application.status === 'PENDING'
  );
  const latestProfileUpdate = applications.find((application) => application.applicationType === 'PROFILE_UPDATE');
  const skillRequests = applications.filter((application) => application.applicationType === 'SKILL_ADDITION');
  const applicationNote = parseNote(profile?.profileApplicationDetails);
  const education = parseRecords(applicationNote['Educational background']);
  const certificates = parseRecords(applicationNote['Professional certificates']);
  const mentorshipHistory = parseRecords(applicationNote['Previous mentorship experience']);
  const careerHistory = parseRecords(applicationNote['General professional experience']);
  const applicationSkills = parseList(applicationNote['Mentoring interests / expertise']);
  const availability = parseAvailability(profile?.availabilityNotes)
    ?? parseAvailability(applicationNote.Availability);
  const mentorshipFormats = availability?.formats.length
    ? availability.formats
    : parseList(applicationNote['Mentorship formats']);
  const committed = profile ? profile.activeTrainees + profile.pendingTrainees : 0;
  const availableCapacity = profile ? Math.max(0, capacity - committed) : 0;
  const capacityPercent = profile && capacity > 0
    ? Math.min(100, Math.round((committed / capacity) * 100))
    : 0;
  if (profileQuery.isLoading || applicationsQuery.isLoading || badgeRemovalQuery.isLoading) {
    return <LoadingSkeleton rows={5} height={32} />;
  }
  if (profileQuery.isError || !profile) {
    return (
      <ErrorState
        message={errorMessage(profileQuery.error)}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }
  if (applicationsQuery.isError || !applicationsQuery.data) {
    return (
      <ErrorState
        message="Unable to load your submitted mentor application."
        onRetry={() => void applicationsQuery.refetch()}
      />
    );
  }
  if (badgeRemovalQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your badge request status."
        onRetry={() => void badgeRemovalQuery.refetch()}
      />
    );
  }

  const requestProfileUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const activeSkillNames = new Set(
      profile.skills.filter((skill) => skill.status === 'ACTIVE').map((skill) => skill.name.toLowerCase())
    );
    const activeCustomSkills = profile.skills
      .filter((skill) => skill.status === 'ACTIVE'
        && !activeSkills.some((catalogSkill) => catalogSkill.name === skill.name))
      .map((skill) => skill.name);
    const selectedCustomSkills = [...new Set([
      ...activeCustomSkills,
      ...otherSkills.split(',').map((skill) => skill.trim()).filter(Boolean),
    ])];
    const selectedSkillNames = [...new Set([
      ...profile.skills.filter((skill) => skill.status === 'ACTIVE').map((skill) => skill.name),
      ...profileDraft.skills.filter((name) => activeSkills.some((skill) => skill.name === name)),
      ...selectedCustomSkills,
    ])];
    const selectedCatalogSkills = activeSkills.filter((skill) => selectedSkillNames.includes(skill.name));
    const requestsNewSkills = selectedSkillNames.some((name) => !activeSkillNames.has(name.toLowerCase()));
    if (selectedSkillNames.length === 0) {
      pushToast({ title: 'Select a skill', message: 'Keep at least one mentoring skill in your profile.', tone: 'info' });
      return;
    }
    if (requestsNewSkills && profileEvidence.length === 0) {
      pushToast({
        title: 'Supporting evidence required',
        message: 'Upload evidence when requesting new mentoring skills.',
        tone: 'err',
      });
      return;
    }
    const availabilityDetails = {
      days: profileDraft.availability.days,
      timeZone: profileDraft.availability.timeZone,
      formats: profileDraft.availability.formats,
    };
    const certificates = profileDraft.certificates.map((record) => ({
      ...record,
      skills: Array.isArray(record.skills)
        ? record.skills.map(String)
        : recordText(record, 'skills').split(',').map((skill) => skill.trim()).filter(Boolean),
    }));
    const profileDetails = [
      'MENTOR APPLICATION DETAILS',
      `Full name: ${profile.fullName}`,
      `Profile picture: ${profile.profilePictureFileName ?? applicationNote['Profile picture'] ?? 'Not provided'}`,
      `Educational background: ${JSON.stringify(profileDraft.education)}`,
      `Mentoring interests / expertise: ${JSON.stringify(selectedSkillNames)}`,
      `Professional certificates: ${JSON.stringify(certificates)}`,
      `Previous mentorship experience: ${profileDraft.mentorship.length
        ? JSON.stringify(profileDraft.mentorship)
        : 'No'}`,
      `General professional experience: ${JSON.stringify(profileDraft.career)}`,
      `Availability: ${JSON.stringify(availabilityDetails)}`,
      `Mentorship formats: ${profileDraft.availability.formats.join(', ')}`,
      `Maximum concurrent mentees: ${profile.maxConcurrentTrainees}`,
      `CV: ${profileDraft.cv}`,
      `Letter of motivation: ${profileDraft.motivationLetter}`,
    ].join('\n');
    const supportingEvidenceContexts = profileEvidence.map((file) => {
      const fileName = file.name.toLowerCase();
      if (profileDraft.cv && fileName === profileDraft.cv.toLowerCase()) return 'Curriculum vitae';
      if (profileDraft.motivationLetter && fileName === profileDraft.motivationLetter.toLowerCase()) {
        return 'Letter of motivation';
      }
      if (profileDraft.education.some((record) =>
        recordText(record, 'certificateDocument').toLowerCase() === fileName)) return 'Education certificate';
      if (profileDraft.certificates.some((record) =>
        recordText(record, 'document').toLowerCase() === fileName)) return 'Professional certificate';
      if (profileDraft.mentorship.some((record) =>
        recordText(record, 'proofDocument').toLowerCase() === fileName)) return 'Mentorship experience evidence';
      return 'Updated profile document';
    });
    profileUpdateMutation.mutate({
      profileDetails,
      availabilityNotes: JSON.stringify(availabilityDetails),
      experienceYears: experienceYears === '' ? null : Number(experienceYears),
      mentoringApproach: mentoringApproach.trim(),
      sessionsPerWeek: sessionsPerWeek === '' ? null : Number(sessionsPerWeek),
      changeNote: changeNote.trim() || undefined,
      catalogSkillIds: selectedCatalogSkills.map((skill) => skill.id),
      customSkill: selectedCustomSkills.join('; ') || undefined,
      supportingEvidenceContexts,
      supportingEvidence: profileEvidence,
    });
  };

  const updateRecord = (section: ProfileRecordSection, index: number, key: string, value: string) => {
    setProfileDraft((current) => ({
      ...current,
      [section]: current[section].map((record, recordIndex) =>
        recordIndex === index ? { ...record, [key]: value } : record
      ),
    }));
  };

  const addRecord = (section: ProfileRecordSection, record: ProfileRecord) => {
    setProfileDraft((current) => ({ ...current, [section]: [...current[section], record] }));
  };

  const removeRecord = (section: ProfileRecordSection, index: number) => {
    setProfileDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, recordIndex) => recordIndex !== index),
    }));
  };

  const updateAvailabilityDay = (dayName: string, checked: boolean) => {
    setProfileDraft((current) => {
      const days = current.availability.days.filter((day) => day.day !== dayName);
      if (checked) days.push({ day: dayName, start: '', end: '' });
      return {
        ...current,
        availability: {
          ...current.availability,
          days: days.sort((left, right) => PROFILE_DAYS.indexOf(left.day) - PROFILE_DAYS.indexOf(right.day)),
        },
      };
    });
  };

  const updateAvailabilityTime = (dayName: string, key: 'start' | 'end', value: string) => {
    setProfileDraft((current) => ({
      ...current,
      availability: {
        ...current.availability,
        days: current.availability.days.map((day) => day.day === dayName ? { ...day, [key]: value } : day),
      },
    }));
  };

  const updatePicture = (image: File | undefined) => {
    if (!image) return;
    if (image.size > 5 * 1024 * 1024) {
      pushToast({ title: 'Picture is too large', message: 'Choose a PNG or JPG image up to 5 MB.', tone: 'err' });
      return;
    }
    setPictureBusy(true);
    void mentoringTrainerApi.updateProfilePicture(image).then(async (updatedProfile) => {
      queryClient.setQueryData(['mentoring', 'trainer-profile'], updatedProfile);
      await refreshProfile();
      pushToast({ title: 'Profile picture updated', message: 'Your new picture is now visible on your profile.', tone: 'ok' });
    }).catch((error: unknown) => {
      pushToast({ title: 'Unable to update profile picture', message: errorMessage(error), tone: 'err' });
    }).finally(() => setPictureBusy(false));
  };

  const downloadEvidence = async (fileId: number, fileName: string) => {
    setDownloadingFileId(fileId);
    try {
      const blob = await mentorApplicationApi.downloadProofDocument(fileId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      pushToast({ title: 'Unable to download application document', message: errorMessage(error), tone: 'err' });
    } finally {
      setDownloadingFileId(null);
    }
  };

  const badgeRequest = badgeRemovalQuery.data;
  const fullName = display(applicationNote['Full name'], profile.fullName);

  return (
    <div className="mentor-profile-page">
      <section className="mentor-profile-hero">
        <div className="mentor-profile-identity">
          {profilePictureUrl ? (
            <img className="mentor-profile-photo" src={profilePictureUrl} alt={`${fullName} profile`} />
          ) : (
            <div className="mentor-profile-photo mentor-profile-photo-fallback" aria-hidden="true">
              {initials(fullName)}
            </div>
          )}
          <div className="mentor-profile-identity-copy">
            <span className="mentor-profile-eyebrow">Mentor profile</span>
            <h2>{fullName}</h2>
            <p>{profile.employeeNumber} · {profile.departmentName ?? 'Department not assigned'}</p>
            <div className="mentor-profile-badges">
              <StatusPill label={profile.status} tone={profile.status === 'ACTIVE' ? 'ok' : 'warn'} />
              <StatusPill
                label={profile.acceptingNewPairings === false ? 'Not accepting matches' : 'Accepting matches'}
                tone={profile.acceptingNewPairings === false ? 'neutral' : 'ok'}
              />
            </div>
          </div>
        </div>
        <label className="mentor-profile-picture-action">
          <Camera size={16} />
          {pictureBusy ? 'Updating…' : 'Change photo'}
          <input
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            aria-label="Change profile picture"
            disabled={pictureBusy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              updatePicture(file);
            }}
          />
        </label>
      </section>

      <section className="mentor-profile-stats" aria-label="Mentor overview">
        <article><span>Approved skills</span><strong>{profile.skills.length}</strong><small>Active mentoring areas</small></article>
        <article><span>Current mentees</span><strong>{profile.activeTrainees}</strong><small>Active pairings</small></article>
        <article><span>Pending requests</span><strong>{profile.pendingTrainees}</strong><small>Awaiting response</small></article>
        <article><span>Available capacity</span><strong>{availableCapacity}</strong><small>Of {capacity} maximum</small></article>
      </section>

      <section className="mentor-profile-capacity">
        <div className="mentor-profile-section-heading">
          <div>
            <h3>Mentoring capacity</h3>
            <p>Change your maximum trainee count immediately. It cannot be lower than your current commitments.</p>
          </div>
          <form
            className="mentor-profile-capacity-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (capacity < committed) {
                pushToast({
                  title: 'Capacity is below current commitments',
                  message: 'Maximum capacity must include active mentees and pending requests.',
                  tone: 'err',
                });
                return;
              }
              capacityMutation.mutate({ maxConcurrentTrainees: capacity });
            }}
          >
            <label>
              <span className="sr-only">Maximum concurrent trainees</span>
              <input
                type="number"
                min={Math.max(1, committed)}
                max={100}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                aria-label="Maximum concurrent trainees"
              />
            </label>
            <button type="submit" disabled={capacityMutation.isPending || capacity === profile.maxConcurrentTrainees}>
              <Save size={15} /> {capacityMutation.isPending ? 'Saving…' : 'Save capacity'}
            </button>
          </form>
        </div>
        <div className="mentor-profile-capacity-track" aria-label={`${capacityPercent}% of capacity committed`}>
          <span style={{ width: `${capacityPercent}%` }} />
        </div>
        <div className="mentor-profile-capacity-foot">
          <span>{committed} of {capacity} trainee places committed</span>
          <strong>{capacityPercent}%</strong>
        </div>
      </section>

      <section className="mentor-profile-content-grid">
        <article className="mentor-profile-panel mentor-profile-wide">
          <header><Sparkles size={18} /><div><h3>Mentoring expertise</h3><p>Skills from your approved application and authorizations.</p></div></header>
          <div className="mentor-profile-tags">
            {profile.skills.length ? profile.skills.map((skill) => (
              <StatusPill key={skill.id} label={skill.name} tone={skill.status === 'ACTIVE' ? 'ok' : 'neutral'} />
            )) : applicationSkills.map((skill) => <StatusPill key={skill} label={skill} tone="neutral" />)}
            {!profile.skills.length && !applicationSkills.length && <span className="mentor-profile-empty">No skills listed.</span>}
          </div>
          {applicationSkills.length > 0 && profile.skills.length > 0 && (
            <p className="mentor-profile-supporting-skills">Application interests: {applicationSkills.join(' · ')}</p>
          )}
        </article>

        <article className="mentor-profile-panel">
          <header><GraduationCap size={18} /><div><h3>Education</h3><p>Qualifications included in your application.</p></div></header>
          {education.length ? education.map((record, index) => (
            <div className="mentor-profile-record" key={`education-${index}`}>
              <strong>{display(record.educationLevel)}</strong>
              <span>{display(record.fieldOfStudy)}</span>
              <small>{display(record.institution)}</small>
              {typeof record.certificateDocument === 'string' && record.certificateDocument && (
                <small className="mentor-profile-file"><FileText size={13} />{record.certificateDocument}</small>
              )}
              {safeUrl(record.certificateLink) && (
                <a href={safeUrl(record.certificateLink) ?? undefined} target="_blank" rel="noreferrer">Open certificate link</a>
              )}
            </div>
          )) : <p className="mentor-profile-empty">No education details were included.</p>}
        </article>

        <article className="mentor-profile-panel">
          <header><Award size={18} /><div><h3>Professional certificates</h3><p>Credentials and skills demonstrated.</p></div></header>
          {certificates.length ? certificates.map((record, index) => (
            <div className="mentor-profile-record" key={`certificate-${index}`}>
              <strong>{display(record.title)}</strong>
              {typeof record.document === 'string' && record.document && (
                <small className="mentor-profile-file"><FileText size={13} />{record.document}</small>
              )}
              {safeUrl(record.link) && (
                <a href={safeUrl(record.link) ?? undefined} target="_blank" rel="noreferrer">Verify certificate</a>
              )}
              {Array.isArray(record.skills) && record.skills.length > 0 && (
                <div className="mentor-profile-tags">
                  {record.skills.map((skill) => <StatusPill key={String(skill)} label={String(skill)} tone="neutral" />)}
                </div>
              )}
            </div>
          )) : <p className="mentor-profile-empty">No professional certificates included.</p>}
        </article>

        <article className="mentor-profile-panel">
          <header><BriefcaseBusiness size={18} /><div><h3>Career experience</h3><p>Professional roles and responsibilities.</p></div></header>
          {careerHistory.length ? careerHistory.map((record, index) => (
            <div className="mentor-profile-record" key={`career-${index}`}>
              <strong>{display(record.title)}</strong>
              <span>{[record.organization, record.years].filter(Boolean).join(' · ') || 'Organization and dates not provided'}</span>
              {typeof record.description === 'string' && record.description && <p>{record.description}</p>}
            </div>
          )) : <p className="mentor-profile-empty">No career history included.</p>}
        </article>

        <article className="mentor-profile-panel">
          <header><HeartHandshake size={18} /><div><h3>Mentorship experience</h3><p>Previous mentoring roles and programs.</p></div></header>
          {mentorshipHistory.length ? mentorshipHistory.map((record, index) => (
            <div className="mentor-profile-record" key={`mentorship-${index}`}>
              <strong>{display(record.role)}</strong>
              <span>{[record.organization, record.years].filter(Boolean).join(' · ') || 'Details not provided'}</span>
              {typeof record.description === 'string' && record.description && <p>{record.description}</p>}
            </div>
          )) : <p className="mentor-profile-empty">{display(applicationNote['Previous mentorship experience'], 'No prior mentorship experience listed.')}</p>}
        </article>

        <article className="mentor-profile-panel">
          <header><CalendarDays size={18} /><div><h3>Availability</h3><p>Preferred schedule and mentoring format.</p></div></header>
          {availability?.days.length ? (
            <div className="mentor-profile-availability">
              {availability.days.map((day, index) => (
                <div key={`${day.day}-${index}`}>
                  <strong>{day.day}</strong>
                  <span>{day.start && day.end ? `${day.start}–${day.end}` : 'Time not specified'}</span>
                </div>
              ))}
              {availability.timeZone && <small><Clock3 size={13} />{availability.timeZone.replace(/_/g, ' ')}</small>}
            </div>
          ) : <p className="mentor-profile-empty">No availability provided.</p>}
          {(mentorshipFormats.length > 0 || profile.sessionsPerWeek != null) && (
            <div className="mentor-profile-tags">
              {mentorshipFormats.map((format) => <StatusPill key={format} label={format} tone="neutral" />)}
              {profile.sessionsPerWeek != null && <StatusPill label={`${profile.sessionsPerWeek} sessions / week`} tone="neutral" />}
            </div>
          )}
        </article>

        <article className="mentor-profile-panel">
          <header><FileText size={18} /><div><h3>Application documents</h3><p>Files submitted with your mentor application.</p></div></header>
          {profile.profileApplicationEvidence?.length ? (
            <div className="mentor-profile-documents">
              {profile.profileApplicationEvidence.map((evidence) => (
                <div key={evidence.fileId}>
                  <span><FileText size={15} /><span><strong>{evidence.fileName}</strong><small>{evidence.context}</small></span></span>
                  <button
                    type="button"
                    disabled={downloadingFileId !== null}
                    onClick={() => void downloadEvidence(evidence.fileId, evidence.fileName)}
                  >
                    <Download size={14} />{downloadingFileId === evidence.fileId ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mentor-profile-documents-summary">
              <span>CV: {display(applicationNote.CV?.split(' (')[0])}</span>
              <span>Motivation letter: {display(applicationNote['Letter of motivation']?.split(' (')[0])}</span>
              <p>Documents are not available for download.</p>
            </div>
          )}
        </article>
      </section>

      <section className="mentor-profile-update-launcher">
        <div>
          <FileText size={18} />
          <span>
            <strong>Profile updates</strong>
            <small>Update your profile and skills with one HR review.</small>
          </span>
        </div>
        {pendingProfileUpdate && <StatusPill label="Pending HR review" tone="warn" />}
        <button type="button" onClick={() => setProfileUpdateModalOpen(true)} aria-haspopup="dialog">
          {pendingProfileUpdate ? 'View request' : 'Edit profile'}
        </button>
      </section>

      {isProfileUpdateModalOpen && (
        <div
          className="apid-modal-backdrop mentor-profile-update-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileUpdateModalOpen(false);
          }}
        >
          <section
            className="apid-card apid-modal mentor-profile-update-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-profile-update-title"
          >
            <header className="mentor-profile-update-modal-header">
              <div>
                <span className="mentor-profile-eyebrow">Mentor profile</span>
                <h3 id="mentor-profile-update-title">Update your complete profile</h3>
                <p>Profile details and skill changes are reviewed together by HR.</p>
              </div>
              <button
                type="button"
                className="mentor-profile-update-close"
                aria-label="Close profile update"
                onClick={() => setProfileUpdateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
        {pendingProfileUpdate ? (
          <div className="mentor-profile-request-status">
            <strong>Your profile update request is being reviewed.</strong>
            <p>Your current approved profile remains active until HR makes a decision.</p>
            {pendingProfileUpdate.note && pendingProfileUpdate.note !== 'Mentor profile update request' && (
              <blockquote>{pendingProfileUpdate.note}</blockquote>
            )}
          </div>
        ) : (
          <form className="mentor-profile-request-form" onSubmit={requestProfileUpdate}>
            {latestProfileUpdate?.status === 'DECLINED' && (
              <div className="mentor-profile-review-note">
                <strong>Previous request declined</strong>
                {latestProfileUpdate.reviewReason && <p>{latestProfileUpdate.reviewReason}</p>}
              </div>
            )}
            <p>Edit any section of your application profile. Skills and all profile details are submitted together for HR review.</p>

            <section className="mentor-profile-editor-section">
              <h4>Mentoring expertise</h4>
              <label>Catalog skills
                <select
                  multiple
                  size={Math.min(7, Math.max(4, activeSkills.length))}
                  value={profileDraft.skills.filter((name) => activeSkills.some((skill) => skill.name === name))}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions, (option) => option.value);
                    const approved = profile.skills
                      .filter((skill) => skill.status === 'ACTIVE')
                      .map((skill) => skill.name);
                    setProfileDraft((current) => ({
                      ...current,
                      skills: [...new Set([
                        ...approved,
                        ...selected,
                        ...otherSkills.split(',').map((name) => name.trim()).filter(Boolean),
                      ])],
                    }));
                  }}
                  disabled={profileUpdateMutation.isPending}
                >
                  {activeSkills.map((skill) => {
                    const approved = profile.skills.some(
                      (authorized) => authorized.status === 'ACTIVE' && authorized.name === skill.name
                    );
                    return <option key={skill.id} value={skill.name} disabled={approved}>
                      {skill.name}{approved ? ' · approved' : ''}
                    </option>;
                  })}
                </select>
                <small>Approved skills remain selected. Add catalog skills here; new skills require evidence.</small>
              </label>
              <label>Other skills (comma separated)
                <input value={otherSkills} maxLength={1000}
                  onChange={(event) => setOtherSkills(event.target.value)}
                  disabled={profileUpdateMutation.isPending} />
              </label>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Education</h4>
              {profileDraft.education.map((record, index) => (
                <fieldset className="mentor-profile-edit-record" key={`education-edit-${index}`}>
                  <legend>Education {index + 1}</legend>
                  {[
                    ['educationLevel', 'Education level'],
                    ['fieldOfStudy', 'Field of study'],
                    ['institution', 'Institution'],
                    ['certificateDocument', 'Document name'],
                    ['certificateLink', 'Certificate link'],
                  ].map(([key, label]) => (
                    <label key={key}>{label}<input value={recordText(record, key)}
                      onChange={(event) => updateRecord('education', index, key, event.target.value)}
                      disabled={profileUpdateMutation.isPending} /></label>
                  ))}
                  <button type="button" onClick={() => removeRecord('education', index)}
                    disabled={profileUpdateMutation.isPending}>Remove</button>
                </fieldset>
              ))}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('education', {
                  educationLevel: '', fieldOfStudy: '', institution: '', certificateDocument: '', certificateLink: '',
                })} disabled={profileUpdateMutation.isPending}>Add education</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Professional certificates</h4>
              {profileDraft.certificates.map((record, index) => (
                <fieldset className="mentor-profile-edit-record" key={`certificate-edit-${index}`}>
                  <legend>Certificate {index + 1}</legend>
                  {[
                    ['title', 'Certificate title'],
                    ['document', 'Document name'],
                    ['link', 'Verification link'],
                  ].map(([key, label]) => (
                    <label key={key}>{label}<input value={recordText(record, key)}
                      onChange={(event) => updateRecord('certificates', index, key, event.target.value)}
                      disabled={profileUpdateMutation.isPending} /></label>
                  ))}
                  <label>Skills demonstrated
                    <input
                      value={Array.isArray(record.skills) ? record.skills.map(String).join(', ') : recordText(record, 'skills')}
                      onChange={(event) => updateRecord('certificates', index, 'skills', event.target.value)}
                      disabled={profileUpdateMutation.isPending} />
                  </label>
                  <button type="button" onClick={() => removeRecord('certificates', index)}
                    disabled={profileUpdateMutation.isPending}>Remove</button>
                </fieldset>
              ))}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('certificates', { title: '', document: '', link: '', skills: [] })}
                disabled={profileUpdateMutation.isPending}>Add certificate</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Professional career history</h4>
              {profileDraft.career.map((record, index) => (
                <fieldset className="mentor-profile-edit-record" key={`career-edit-${index}`}>
                  <legend>Role {index + 1}</legend>
                  {[
                    ['title', 'Job title'],
                    ['organization', 'Organization'],
                    ['years', 'Years'],
                  ].map(([key, label]) => (
                    <label key={key}>{label}<input value={recordText(record, key)}
                      onChange={(event) => updateRecord('career', index, key, event.target.value)}
                      disabled={profileUpdateMutation.isPending} /></label>
                  ))}
                  <label>Responsibilities
                    <textarea rows={2} value={recordText(record, 'description')}
                      onChange={(event) => updateRecord('career', index, 'description', event.target.value)}
                      disabled={profileUpdateMutation.isPending} />
                  </label>
                  <button type="button" onClick={() => removeRecord('career', index)}
                    disabled={profileUpdateMutation.isPending}>Remove</button>
                </fieldset>
              ))}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('career', { title: '', organization: '', years: '', description: '' })}
                disabled={profileUpdateMutation.isPending}>Add career role</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Mentorship experience</h4>
              {profileDraft.mentorship.map((record, index) => (
                <fieldset className="mentor-profile-edit-record" key={`mentorship-edit-${index}`}>
                  <legend>Experience {index + 1}</legend>
                  {[
                    ['role', 'Role'],
                    ['organization', 'Organization'],
                    ['years', 'Years'],
                    ['proofDocument', 'Evidence document name'],
                    ['proofLink', 'Verification link'],
                  ].map(([key, label]) => (
                    <label key={key}>{label}<input value={recordText(record, key)}
                      onChange={(event) => updateRecord('mentorship', index, key, event.target.value)}
                      disabled={profileUpdateMutation.isPending} /></label>
                  ))}
                  <label>Description
                    <textarea rows={2} value={recordText(record, 'description')}
                      onChange={(event) => updateRecord('mentorship', index, 'description', event.target.value)}
                      disabled={profileUpdateMutation.isPending} />
                  </label>
                  <button type="button" onClick={() => removeRecord('mentorship', index)}
                    disabled={profileUpdateMutation.isPending}>Remove</button>
                </fieldset>
              ))}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('mentorship', {
                  role: '', organization: '', years: '', description: '', proofDocument: '', proofLink: '',
                })} disabled={profileUpdateMutation.isPending}>Add mentorship experience</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Availability and mentoring format</h4>
              <div className="mentor-profile-check-grid">
                {PROFILE_DAYS.map((dayName) => {
                  const day = profileDraft.availability.days.find((item) => item.day === dayName);
                  return (
                    <div className="mentor-profile-day-editor" key={dayName}>
                      <label><input type="checkbox" checked={Boolean(day)}
                        onChange={(event) => updateAvailabilityDay(dayName, event.target.checked)}
                        disabled={profileUpdateMutation.isPending} />{dayName}</label>
                      {day && (
                        <>
                          <input type="time" aria-label={`${dayName} start time`} value={day.start}
                            onChange={(event) => updateAvailabilityTime(dayName, 'start', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                          <input type="time" aria-label={`${dayName} end time`} value={day.end}
                            onChange={(event) => updateAvailabilityTime(dayName, 'end', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <label>Time zone
                <input value={profileDraft.availability.timeZone}
                  onChange={(event) => setProfileDraft((current) => ({
                    ...current,
                    availability: { ...current.availability, timeZone: event.target.value },
                  }))} disabled={profileUpdateMutation.isPending} />
              </label>
              <div className="mentor-profile-check-grid">
                {MENTORING_FORMATS.map((format) => (
                  <label key={format}><input type="checkbox"
                    checked={profileDraft.availability.formats.includes(format)}
                    onChange={(event) => setProfileDraft((current) => ({
                      ...current,
                      availability: {
                        ...current.availability,
                        formats: event.target.checked
                          ? [...new Set([...current.availability.formats, format])]
                          : current.availability.formats.filter((item) => item !== format),
                      },
                    }))} disabled={profileUpdateMutation.isPending} />{format}</label>
                ))}
              </div>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Mentorship preferences</h4>
              <div className="mentor-profile-form-grid">
                <label>Years of professional experience
                  <input type="number" min={0} value={experienceYears}
                    onChange={(event) => setExperienceYears(event.target.value)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label>Sessions per week
                  <input type="number" min={0} value={sessionsPerWeek}
                    onChange={(event) => setSessionsPerWeek(event.target.value)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label className="is-wide">Mentoring approach
                  <textarea rows={3} maxLength={2000} value={mentoringApproach}
                    onChange={(event) => setMentoringApproach(event.target.value)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
              </div>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>CV and motivation letter</h4>
              <div className="mentor-profile-form-grid">
                <label>CV document name
                  <input value={profileDraft.cv}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, cv: event.target.value }))}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label>Motivation letter name
                  <input value={profileDraft.motivationLetter}
                    onChange={(event) => setProfileDraft((current) => ({
                      ...current,
                      motivationLetter: event.target.value,
                    }))} disabled={profileUpdateMutation.isPending} />
                </label>
                <label className="is-wide">Supporting documents
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple
                    onChange={(event) => setProfileEvidence(Array.from(event.target.files ?? []))}
                    disabled={profileUpdateMutation.isPending} />
                  <small>Upload evidence for profile changes and any new mentoring skills.</small>
                </label>
              </div>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Note for HR (optional)</h4>
              <label>Additional context
                <textarea rows={2} maxLength={1000} value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="Explain any changes that may need extra context."
                  disabled={profileUpdateMutation.isPending} />
              </label>
            </section>

            {skillRequests.length > 0 && (
              <div className="mentor-profile-request-history">
                {skillRequests.map((request) => (
                  <div key={request.id}>
                    <span>Previous skill request: {request.skillNames.join(', ') || request.customSkill || 'Skill request'}</span>
                    <StatusPill label={request.status}
                      tone={request.status === 'APPROVED' ? 'ok' : request.status === 'DECLINED' ? 'err' : 'warn'} />
                    {request.reviewReason && <small>{request.reviewReason}</small>}
                  </div>
                ))}
              </div>
            )}

            <span className="mentor-profile-supporting-skills">
              {profileEvidence.length} supporting file{profileEvidence.length === 1 ? '' : 's'} selected.
            </span>
            <button type="submit" disabled={profileUpdateMutation.isPending}>
              <FileText size={15} />{profileUpdateMutation.isPending ? 'Sending request…' : 'Submit complete profile for HR review'}
            </button>
          </form>
        )}
          </section>
        </div>
      )}

      <details className="mentor-profile-action-panel mentor-profile-badge-removal">
        <summary>
          <div><ShieldCheck size={18} /><span><strong>Mentor badge settings</strong><small>Request removal of your mentor authorization through HR.</small></span></div>
          {badgeRequest?.status === 'PENDING'
            ? <StatusPill label="Pending review" tone="warn" />
            : <span className="mentor-profile-summary-chevron">+</span>}
        </summary>
        <div className="mentor-profile-request-status">
          {badgeRequest?.status === 'PENDING' ? (
            <>
              <strong>Your badge removal request is awaiting HR review.</strong>
              {badgeRequest.reason && <p>{badgeRequest.reason}</p>}
            </>
          ) : badgeRequest?.status === 'APPROVED' ? (
            <>
              <strong>Badge removal request approved</strong>
              <p>{badgeRequest.decisionReason || 'Your mentor authorization was updated.'}</p>
            </>
          ) : (
            <>
              {badgeRequest?.status === 'DECLINED' && (
                <div className="mentor-profile-review-note">
                  <strong>Previous request declined</strong>
                  {badgeRequest.decisionReason && <p>{badgeRequest.decisionReason}</p>}
                </div>
              )}
              <label>Reason (optional)
                <textarea rows={2} value={badgeRemovalReason} onChange={(event) => setBadgeRemovalReason(event.target.value)} />
              </label>
              <button
                type="button"
                disabled={badgeRemovalMutation.isPending}
                onClick={() => badgeRemovalMutation.mutate(badgeRemovalReason.trim() || undefined)}
              >
                {badgeRemovalMutation.isPending ? 'Sending…' : 'Request badge removal'}
              </button>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
