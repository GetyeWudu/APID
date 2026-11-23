import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BriefcaseBusiness,
  Camera,
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
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import './MentorProfileForm.css';

type ProfileRecord = Record<string, unknown> & {
  _draftId?: string;
  _isNew?: boolean;
  _evidenceFile?: File;
};
type ProfileDraft = {
  education: ProfileRecord[];
  certificates: ProfileRecord[];
  mentorship: ProfileRecord[];
  career: ProfileRecord[];
  skills: string[];
  cv: string;
  motivationLetter: string;
};
type ProfileRecordSection = 'education' | 'certificates' | 'mentorship' | 'career';

const EDUCATION_LEVEL_SUGGESTIONS = [
  'High School',
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Other',
];
const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  education: [],
  certificates: [],
  mentorship: [],
  career: [],
  skills: [],
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

function display(value: unknown, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function recordText(record: ProfileRecord, key: string) {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function recordEvidenceFile(record: ProfileRecord) {
  return typeof File !== 'undefined' && record._evidenceFile instanceof File
    ? record._evidenceFile
    : undefined;
}

function isProfileRecordBlank(record: ProfileRecord) {
  return Object.entries(record).every(([key, value]) => {
    if (key.startsWith('_')) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return value == null;
  }) && !recordEvidenceFile(record);
}

function withoutProfileDraftFields(record: ProfileRecord) {
  const { _draftId: _draftId, _isNew: _isNew, _evidenceFile: _evidenceFile, ...values } = record;
  return values;
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
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [motivationLetterFile, setMotivationLetterFile] = useState<File | null>(null);
  const [profileEvidence, setProfileEvidence] = useState<File[]>([]);
  const [isProfileUpdateModalOpen, setProfileUpdateModalOpen] = useState(false);
  const [badgeRemovalReason, setBadgeRemovalReason] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const draftRecordSequence = useRef(0);

  const profileQuery = useQuery({
    queryKey: ['mentoring', 'trainer-profile'],
    queryFn: mentoringTrainerApi.getProfile,
  });
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'mine', currentUserId],
    queryFn: mentorApplicationApi.listMine,
  });
  const mentorRatingQuery = useQuery({
    queryKey: ['mentoring', 'mentor-session-rating', currentUserId],
    queryFn: mentoringPairingApi.getMyMentorRating,
    enabled: profileQuery.data?.status === 'ACTIVE',
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
      setCvFile(null);
      setMotivationLetterFile(null);
      setProfileEvidence([]);
      setProfileUpdateModalOpen(false);
      pushToast({
        title: 'Update request sent',
        message: 'Your complete profile and skill changes are awaiting review.',
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
  const approvedSkillNames = new Set((profile?.skills ?? []).map((skill) => skill.name.trim().toLowerCase()));
  const additionalApplicationSkills = applicationSkills.filter(
    (skill) => !approvedSkillNames.has(skill.trim().toLowerCase())
  );
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
    if (experienceYears !== '' && (!/^\d+$/.test(experienceYears) || Number(experienceYears) > 80)) {
      pushToast({
        title: 'Invalid experience years',
        message: 'Enter a whole number from 0 to 80.',
        tone: 'err',
      });
      return;
    }
    if (sessionsPerWeek !== '' && (!/^\d+$/.test(sessionsPerWeek) || Number(sessionsPerWeek) > 100)) {
      pushToast({
        title: 'Invalid weekly sessions',
        message: 'Enter a whole number from 0 to 100.',
        tone: 'err',
      });
      return;
    }
    const newEducation = profileDraft.education.filter((record) => record._isNew && !isProfileRecordBlank(record));
    const newCertificates = profileDraft.certificates.filter((record) => record._isNew && !isProfileRecordBlank(record));
    const newCareer = profileDraft.career.filter((record) => record._isNew && !isProfileRecordBlank(record));
    const newMentorship = profileDraft.mentorship.filter((record) => record._isNew && !isProfileRecordBlank(record));

    if (newEducation.some((record) =>
      !recordText(record, 'educationLevel').trim()
      || !recordText(record, 'fieldOfStudy').trim()
      || !recordText(record, 'institution').trim()
      || (!recordEvidenceFile(record) && !recordText(record, 'certificateLink').trim())
    )) {
      pushToast({
        title: 'Complete education details',
        message: 'Each new education record needs a level, field, institution, and uploaded document or certificate link.',
        tone: 'err',
      });
      return;
    }
    if (newCertificates.some((record) =>
      !recordText(record, 'title').trim()
      || (!recordEvidenceFile(record) && !recordText(record, 'link').trim())
    )) {
      pushToast({
        title: 'Complete certificate details',
        message: 'Each new professional certificate needs a title and an uploaded document or verification link.',
        tone: 'err',
      });
      return;
    }
    if (newCareer.some((record) =>
      !recordText(record, 'title').trim()
      || !recordText(record, 'organization').trim()
      || !recordText(record, 'years').trim()
    )) {
      pushToast({
        title: 'Complete professional experience',
        message: 'Each new professional experience needs a role, organization, and years.',
        tone: 'err',
      });
      return;
    }
    if (newMentorship.some((record) =>
      !recordText(record, 'role').trim()
      || !recordText(record, 'organization').trim()
      || !recordText(record, 'years').trim()
    )) {
      pushToast({
        title: 'Complete mentorship experience',
        message: 'Each new mentorship experience needs a role, organization, and years.',
        tone: 'err',
      });
      return;
    }

    const certificateLinks = [
      ...newEducation.map((record) => recordText(record, 'certificateLink')),
      ...newCertificates.map((record) => recordText(record, 'link')),
      ...newCareer.map((record) => recordText(record, 'proofLink')),
      ...newMentorship.map((record) => recordText(record, 'proofLink')),
    ];
    if (certificateLinks.some((link) => link.trim() && !safeUrl(link))) {
      pushToast({
        title: 'Invalid verification link',
        message: 'Use a valid HTTP or HTTPS link for each new record.',
        tone: 'err',
      });
      return;
    }

    const recordEvidence = [
      ...newEducation.map((record) => ({ record, section: 'Education certificate' })),
      ...newCertificates.map((record) => ({ record, section: 'Professional certificate' })),
      ...newCareer.map((record) => ({ record, section: 'Professional experience' })),
      ...newMentorship.map((record) => ({ record, section: 'Mentorship experience evidence' })),
    ].flatMap(({ record, section }) => {
      const file = recordEvidenceFile(record);
      return file ? [{ file, context: `${section}: ${recordText(record, 'title') || recordText(record, 'role') || recordText(record, 'educationLevel')}` }] : [];
    });
    const additionalEvidence = [
      ...(cvFile ? [{ file: cvFile, context: 'Curriculum vitae' }] : []),
      ...(motivationLetterFile ? [{ file: motivationLetterFile, context: 'Letter of motivation' }] : []),
      ...profileEvidence.map((file) => ({ file, context: '' })),
    ];
    const evidenceUploads = [...additionalEvidence.map((item) => item.file), ...recordEvidence.map((item) => item.file)];

    if (evidenceUploads.some((file) => !/\.(pdf|doc|docx|png|jpe?g)$/i.test(file.name)
      || file.size > 10 * 1024 * 1024)) {
      pushToast({
        title: 'Invalid supporting document',
        message: 'Choose PDF, DOC, DOCX, PNG, or JPG files up to 10 MB.',
        tone: 'err',
      });
      return;
    }

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
    if (requestsNewSkills && evidenceUploads.length === 0) {
      pushToast({
        title: 'Supporting evidence required',
        message: 'Upload evidence when requesting new mentoring skills.',
        tone: 'err',
      });
      return;
    }
    const education = profileDraft.education
      .filter((record) => !record._isNew || !isProfileRecordBlank(record))
      .map((record) => ({
        ...withoutProfileDraftFields(record),
        educationLevel: recordText(record, 'educationLevel').trim(),
        fieldOfStudy: recordText(record, 'fieldOfStudy').trim(),
        institution: recordText(record, 'institution').trim(),
        certificateDocument: recordText(record, 'certificateDocument').trim()
          || recordEvidenceFile(record)?.name || '',
        certificateLink: recordText(record, 'certificateLink').trim(),
      }));
    const certificates = profileDraft.certificates
      .filter((record) => !record._isNew || !isProfileRecordBlank(record))
      .map((record) => ({
        ...withoutProfileDraftFields(record),
        title: recordText(record, 'title').trim(),
        document: recordText(record, 'document').trim() || recordEvidenceFile(record)?.name || '',
        link: recordText(record, 'link').trim(),
        skills: Array.isArray(record.skills)
          ? record.skills.map(String)
          : recordText(record, 'skills').split(',').map((skill) => skill.trim()).filter(Boolean),
      }));
    const career = profileDraft.career
      .filter((record) => !record._isNew || !isProfileRecordBlank(record))
      .map((record) => ({
        ...withoutProfileDraftFields(record),
        proofDocument: recordText(record, 'proofDocument').trim() || recordEvidenceFile(record)?.name || '',
      }));
    const mentorship = profileDraft.mentorship
      .filter((record) => !record._isNew || !isProfileRecordBlank(record))
      .map((record) => ({
        ...withoutProfileDraftFields(record),
        proofDocument: recordText(record, 'proofDocument').trim() || recordEvidenceFile(record)?.name || '',
      }));
    const profileDetails = [
      'MENTOR APPLICATION DETAILS',
      `Full name: ${profile.fullName}`,
      `Profile picture: ${profile.profilePictureFileName ?? applicationNote['Profile picture'] ?? 'Not provided'}`,
      `Educational background: ${JSON.stringify(education)}`,
      `Mentoring interests / expertise: ${JSON.stringify(selectedSkillNames)}`,
      `Professional certificates: ${JSON.stringify(certificates)}`,
      `Previous mentorship experience: ${mentorship.length
        ? JSON.stringify(mentorship)
        : 'No'}`,
      `General professional experience: ${JSON.stringify(career)}`,
      `Maximum concurrent mentees: ${profile.maxConcurrentTrainees}`,
      `CV: ${cvFile?.name ?? profileDraft.cv}`,
      `Letter of motivation: ${motivationLetterFile?.name ?? profileDraft.motivationLetter}`,
    ].join('\n');
    const additionalEvidenceContexts = additionalEvidence.map(({ file, context }) => {
      if (context) return context;
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
    const supportingEvidenceContexts = [...additionalEvidenceContexts, ...recordEvidence.map((item) => item.context)];
    profileUpdateMutation.mutate({
      profileDetails,
      experienceYears: experienceYears === '' ? null : Number(experienceYears),
      mentoringApproach: mentoringApproach.trim(),
      sessionsPerWeek: sessionsPerWeek === '' ? null : Number(sessionsPerWeek),
      changeNote: changeNote.trim() || undefined,
      catalogSkillIds: selectedCatalogSkills.map((skill) => skill.id),
      customSkill: selectedCustomSkills.join('; ') || undefined,
      supportingEvidenceContexts,
      supportingEvidence: evidenceUploads,
    });
  };

  const updateRecord = (
    section: ProfileRecordSection,
    index: number,
    key: string,
    value: string | File | undefined
  ) => {
    setProfileDraft((current) => ({
      ...current,
      [section]: current[section].map((record, recordIndex) =>
        recordIndex === index && record._isNew ? { ...record, [key]: value } : record
      ),
    }));
  };

  const addRecord = (section: ProfileRecordSection, record: ProfileRecord) => {
    setProfileDraft((current) => ({
      ...current,
      [section]: [...current[section], {
        ...record,
        _draftId: `new-${draftRecordSequence.current++}`,
        _isNew: true,
      }],
    }));
  };

  const removeRecord = (section: ProfileRecordSection, index: number) => {
    setProfileDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, recordIndex) => recordIndex !== index),
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

      {mentorRatingQuery.isError && (
        <ErrorState
          message="Unable to load your session rating."
          onRetry={() => void mentorRatingQuery.refetch()}
        />
      )}
      {mentorRatingQuery.data?.averageRating != null && (
        <section className="apid-card" aria-label="Your mentor rating">
          <strong>Session rating: {mentorRatingQuery.data.averageRating.toFixed(1)} / 5</strong>
        </section>
      )}

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
          {additionalApplicationSkills.length > 0 && profile.skills.length > 0 && (
            <p className="mentor-profile-supporting-skills">Other application interests: {additionalApplicationSkills.join(' · ')}</p>
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
          <header><HeartHandshake size={18} /><div><h3>Mentorship preferences</h3><p>Your experience and mentoring approach.</p></div></header>
          <div className="mentor-profile-record">
            <strong>{profile.experienceYears == null
              ? 'Years of professional experience not provided'
              : `${profile.experienceYears} year${profile.experienceYears === 1 ? '' : 's'} of professional experience`}</strong>
            <span>{profile.sessionsPerWeek == null
              ? 'Sessions per week not provided'
              : `${profile.sessionsPerWeek} sessions per week`}</span>
            {profile.mentoringApproach && <p>{profile.mentoringApproach}</p>}
          </div>
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
            <small>Update your profile and skills with one review.</small>
          </span>
        </div>
        {pendingProfileUpdate && <StatusPill label="Pending review" tone="warn" />}
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
            <p>Edit any section of your application profile. Skills and all profile details are submitted together for review.</p>

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
              <p className="boa-muted">
                Existing education, certificate, career, and mentorship records are read-only. Remove one and add a replacement to update it.
              </p>
              {profileDraft.education.map((record, index) => {
                const isNew = record._isNew === true;
                return (
                  <fieldset className="mentor-profile-edit-record" key={record._draftId ?? `education-edit-${index}`}>
                    <legend>{isNew ? 'New education' : `Education ${index + 1}`}</legend>
                    {isNew ? (
                      <>
                        <label>Education level
                          <select
                            value={recordText(record, 'educationLevel')}
                            onChange={(event) => updateRecord('education', index, 'educationLevel', event.target.value)}
                            disabled={profileUpdateMutation.isPending}>
                            <option value="">Select education level</option>
                            {EDUCATION_LEVEL_SUGGESTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                          </select>
                        </label>
                        <label>Field of study
                          <input type="text" maxLength={200} value={recordText(record, 'fieldOfStudy')}
                            onChange={(event) => updateRecord('education', index, 'fieldOfStudy', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Institution
                          <input type="text" maxLength={200} value={recordText(record, 'institution')}
                            onChange={(event) => updateRecord('education', index, 'institution', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Upload education document
                          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              updateRecord('education', index, '_evidenceFile', file);
                              if (file) updateRecord('education', index, 'certificateDocument', file.name);
                            }}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Certificate link (optional)
                          <input type="url" maxLength={1000} placeholder="https://"
                            value={recordText(record, 'certificateLink')}
                            onChange={(event) => updateRecord('education', index, 'certificateLink', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                      </>
                    ) : (
                      <div className="mentor-profile-record">
                        <strong>{recordText(record, 'educationLevel')}</strong>
                        <span>{recordText(record, 'fieldOfStudy')}</span>
                        <small>{recordText(record, 'institution')}</small>
                        {recordText(record, 'certificateDocument') && <small>{recordText(record, 'certificateDocument')}</small>}
                        {recordText(record, 'certificateLink') && <a href={safeUrl(record.certificateLink) ?? undefined}
                          target="_blank" rel="noreferrer">Open certificate link</a>}
                      </div>
                    )}
                    <button type="button" onClick={() => removeRecord('education', index)}
                      disabled={profileUpdateMutation.isPending}>Remove</button>
                  </fieldset>
                );
              })}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('education', {
                  educationLevel: '', fieldOfStudy: '', institution: '', certificateDocument: '', certificateLink: '',
                })} disabled={profileUpdateMutation.isPending}>Add education</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Professional certificates</h4>
              {profileDraft.certificates.map((record, index) => {
                const isNew = record._isNew === true;
                return (
                  <fieldset className="mentor-profile-edit-record" key={record._draftId ?? `certificate-edit-${index}`}>
                    <legend>{isNew ? 'New professional certificate' : `Certificate ${index + 1}`}</legend>
                    {isNew ? (
                      <>
                        <label>Certificate title
                          <input type="text" maxLength={200} value={recordText(record, 'title')}
                            onChange={(event) => updateRecord('certificates', index, 'title', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Upload certificate document
                          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              updateRecord('certificates', index, '_evidenceFile', file);
                              if (file) updateRecord('certificates', index, 'document', file.name);
                            }}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Verification link (optional)
                          <input type="url" maxLength={1000} placeholder="https://"
                            value={recordText(record, 'link')}
                            onChange={(event) => updateRecord('certificates', index, 'link', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Skills demonstrated
                          <input value={Array.isArray(record.skills) ? record.skills.map(String).join(', ') : recordText(record, 'skills')}
                            onChange={(event) => updateRecord('certificates', index, 'skills', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                      </>
                    ) : (
                      <div className="mentor-profile-record">
                        <strong>{recordText(record, 'title')}</strong>
                        {recordText(record, 'document') && <small>{recordText(record, 'document')}</small>}
                        {recordText(record, 'link') && <a href={safeUrl(record.link) ?? undefined}
                          target="_blank" rel="noreferrer">Open verification link</a>}
                        {Array.isArray(record.skills) && record.skills.length > 0 && (
                          <div className="mentor-profile-tags">
                            {record.skills.map((skill) => (
                              <StatusPill key={String(skill)} label={String(skill)} tone="neutral" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => removeRecord('certificates', index)}
                      disabled={profileUpdateMutation.isPending}>Remove</button>
                  </fieldset>
                );
              })}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('certificates', { title: '', document: '', link: '', skills: [] })}
                disabled={profileUpdateMutation.isPending}>Add certificate</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Professional career history</h4>
              {profileDraft.career.map((record, index) => {
                const isNew = record._isNew === true;
                return (
                  <fieldset className="mentor-profile-edit-record" key={record._draftId ?? `career-edit-${index}`}>
                    <legend>{isNew ? 'New professional experience' : `Role ${index + 1}`}</legend>
                    {isNew ? (
                      <>
                        {[
                          ['title', 'Job title'],
                          ['organization', 'Organization'],
                          ['years', 'Years'],
                        ].map(([key, label]) => (
                          <label key={key}>{label}<input type="text" maxLength={200}
                            value={recordText(record, key)}
                            onChange={(event) => updateRecord('career', index, key, event.target.value)}
                            disabled={profileUpdateMutation.isPending} /></label>
                        ))}
                        <label>Responsibilities
                          <textarea rows={2} maxLength={1000} value={recordText(record, 'description')}
                            onChange={(event) => updateRecord('career', index, 'description', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Upload experience proof (optional)
                          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              updateRecord('career', index, '_evidenceFile', file);
                              if (file) updateRecord('career', index, 'proofDocument', file.name);
                            }}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                      </>
                    ) : (
                      <div className="mentor-profile-record">
                        <strong>{recordText(record, 'title')}</strong>
                        <span>{recordText(record, 'organization')}</span>
                        <small>{recordText(record, 'years')}</small>
                        {recordText(record, 'description') && <small>{recordText(record, 'description')}</small>}
                        {recordText(record, 'proofDocument') && <small>{recordText(record, 'proofDocument')}</small>}
                      </div>
                    )}
                    <button type="button" onClick={() => removeRecord('career', index)}
                      disabled={profileUpdateMutation.isPending}>Remove</button>
                  </fieldset>
                );
              })}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('career', { title: '', organization: '', years: '', description: '' })}
                disabled={profileUpdateMutation.isPending}>Add career role</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Mentorship experience</h4>
              {profileDraft.mentorship.map((record, index) => {
                const isNew = record._isNew === true;
                return (
                  <fieldset className="mentor-profile-edit-record" key={record._draftId ?? `mentorship-edit-${index}`}>
                    <legend>{isNew ? 'New mentorship experience' : `Experience ${index + 1}`}</legend>
                    {isNew ? (
                      <>
                        {[
                          ['role', 'Role'],
                          ['organization', 'Organization'],
                          ['years', 'Years'],
                        ].map(([key, label]) => (
                          <label key={key}>{label}<input type="text" maxLength={200}
                            value={recordText(record, key)}
                            onChange={(event) => updateRecord('mentorship', index, key, event.target.value)}
                            disabled={profileUpdateMutation.isPending} /></label>
                        ))}
                        <label>Description
                          <textarea rows={2} maxLength={1000} value={recordText(record, 'description')}
                            onChange={(event) => updateRecord('mentorship', index, 'description', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Upload mentorship proof (optional)
                          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              updateRecord('mentorship', index, '_evidenceFile', file);
                              if (file) updateRecord('mentorship', index, 'proofDocument', file.name);
                            }}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                        <label>Verification link (optional)
                          <input type="url" maxLength={1000} placeholder="https://"
                            value={recordText(record, 'proofLink')}
                            onChange={(event) => updateRecord('mentorship', index, 'proofLink', event.target.value)}
                            disabled={profileUpdateMutation.isPending} />
                        </label>
                      </>
                    ) : (
                      <div className="mentor-profile-record">
                        <strong>{recordText(record, 'role')}</strong>
                        <span>{recordText(record, 'organization')}</span>
                        <small>{recordText(record, 'years')}</small>
                        {recordText(record, 'description') && <small>{recordText(record, 'description')}</small>}
                        {recordText(record, 'proofDocument') && <small>{recordText(record, 'proofDocument')}</small>}
                        {recordText(record, 'proofLink') && <a href={safeUrl(record.proofLink) ?? undefined}
                          target="_blank" rel="noreferrer">Open verification link</a>}
                      </div>
                    )}
                    <button type="button" onClick={() => removeRecord('mentorship', index)}
                      disabled={profileUpdateMutation.isPending}>Remove</button>
                  </fieldset>
                );
              })}
              <button type="button" className="mentor-profile-add-record"
                onClick={() => addRecord('mentorship', {
                  role: '', organization: '', years: '', description: '', proofDocument: '', proofLink: '',
                })} disabled={profileUpdateMutation.isPending}>Add mentorship experience</button>
            </section>

            <section className="mentor-profile-editor-section">
              <h4>Mentorship preferences</h4>
              <div className="mentor-profile-form-grid">
                <label>Years of professional experience
                  <input type="number" min={0} max={80} step={1} value={experienceYears}
                    onChange={(event) => setExperienceYears(event.target.value)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label>Sessions per week
                  <input type="number" min={0} max={100} step={1} value={sessionsPerWeek}
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
                <label>CV document
                  <small>{profileDraft.cv || 'No CV uploaded yet.'}</small>
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label>Motivation letter document
                  <small>{profileDraft.motivationLetter || 'No motivation letter uploaded yet.'}</small>
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(event) => setMotivationLetterFile(event.target.files?.[0] ?? null)}
                    disabled={profileUpdateMutation.isPending} />
                </label>
                <label className="is-wide">Supporting documents
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple
                    onChange={(event) => setProfileEvidence(Array.from(event.target.files ?? []))}
                    disabled={profileUpdateMutation.isPending} />
                  <small>Upload supporting evidence for profile changes or new mentoring skills. Uploaded file names are used automatically.</small>
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
              <FileText size={15} />{profileUpdateMutation.isPending ? 'Sending request…' : 'Submit complete profile for review'}
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
