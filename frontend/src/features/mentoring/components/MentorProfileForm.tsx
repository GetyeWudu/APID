import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Save } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import { HR_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';

function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to load your mentor profile.';
}

type ProfileNoteRecord = Record<string, unknown>;

function parseProfileNote(note: string | null | undefined) {
  const values: Record<string, string> = {};
  note?.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator > 0) values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  });
  return values;
}

function parseProfileRecords(value: string | undefined): ProfileNoteRecord[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((record): record is ProfileNoteRecord =>
        Boolean(record) && typeof record === 'object' && !Array.isArray(record))
      : [];
  } catch {
    return [];
  }
}

function parseProfileList(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
  } catch {
    // Older application notes store this as comma-separated text.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseProfileAvailability(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const availability = parsed as Record<string, unknown>;
    const days = Array.isArray(availability.days)
      ? availability.days.filter((entry): entry is ProfileNoteRecord =>
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

function profileNoteText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

function safeProfileUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function MentorProfileForm({
  activeSkills,
  currentUserId,
}: {
  activeSkills: SkillItem[];
  currentUserId: number;
}) {
  const { hasAnyPermission } = useAuth();
  const isHrAdmin = hasAnyPermission(HR_MODULE_PERMISSIONS);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
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
    enabled: !isHrAdmin,
  });
  const [experienceYears, setExperienceYears] = useState('');
  const [mentoringApproach, setMentoringApproach] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('');
  const [maxConcurrentTrainees, setMaxConcurrentTrainees] = useState(3);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [skillEvidence, setSkillEvidence] = useState<File[]>([]);
  const [skillRequestNote, setSkillRequestNote] = useState('');
  const [badgeRemovalReason, setBadgeRemovalReason] = useState('');
  const [downloadingProfileEvidenceId, setDownloadingProfileEvidenceId] = useState<number | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    setExperienceYears(profileQuery.data.experienceYears?.toString() ?? '');
    setMentoringApproach(profileQuery.data.mentoringApproach ?? profileQuery.data.bio ?? '');
    setAvailabilityNotes(profileQuery.data.availabilityNotes ?? '');
    setSessionsPerWeek(profileQuery.data.sessionsPerWeek?.toString() ?? '');
    setMaxConcurrentTrainees(profileQuery.data.maxConcurrentTrainees);
  }, [profileQuery.data]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (profilePictureFile) {
      const previewUrl = URL.createObjectURL(profilePictureFile);
      setProfilePictureUrl(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
    }
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
        pushToast({
          title: 'Unable to load profile picture',
          message: errorMessage(error),
          tone: 'err',
        });
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profilePictureFile, profileQuery.data?.profilePictureFileId, pushToast]);

  const profileUpdateMutation = useMutation({
    mutationFn: mentorApplicationApi.requestProfileUpdate,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications', 'mine', currentUserId] }),
      ]);
      await applicationsQuery.refetch();
      pushToast({
        title: 'Profile update sent for review',
        message: 'Your current mentor profile remains active until HR approves the changes.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to request profile update',
      message: errorMessage(error),
      tone: 'err',
    }),
  });
  const profilePictureMutation = useMutation({
    mutationFn: mentoringTrainerApi.updateProfilePicture,
    onSuccess: async () => {
      setProfilePictureFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      ]);
      pushToast({
        title: 'Profile picture updated',
        message: 'Your profile picture is active immediately.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      setProfilePictureFile(null);
      pushToast({
        title: 'Unable to update profile picture',
        message: errorMessage(error),
        tone: 'err',
      });
    },
  });
  const skillRequestMutation = useMutation({
    mutationFn: mentorApplicationApi.requestSkillAddition,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'applications', 'mine', currentUserId],
      });
      await applicationsQuery.refetch();
      setSkillIds([]);
      setCustomSkill('');
      setSkillEvidence([]);
      setSkillRequestNote('');
      pushToast({
        title: 'Skill request submitted',
        message: 'HR must approve the requested skills before they are added to your mentor profile.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to request skills',
      message: errorMessage(error),
      tone: 'err',
    }),
  });
  const badgeRemovalMutation = useMutation({
    mutationFn: mentoringTrainerApi.submitBadgeRemovalRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'badge-removal-request', currentUserId],
      });
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const activeCommitments = (profileQuery.data?.activeTrainees ?? 0)
      + (profileQuery.data?.pendingTrainees ?? 0);
    if (maxConcurrentTrainees < activeCommitments) {
      pushToast({
        title: 'Capacity is below current commitments',
        message: 'Maximum concurrent trainees must include your active mentees and pending requests.',
        tone: 'err',
      });
      return;
    }
    profileUpdateMutation.mutate({
      bio: mentoringApproach.trim(),
      availabilityNotes: availabilityNotes.trim(),
      experienceYears: experienceYears === '' ? null : Number(experienceYears),
      mentoringApproach: mentoringApproach.trim(),
      sessionsPerWeek: sessionsPerWeek === '' ? null : Number(sessionsPerWeek),
      maxConcurrentTrainees,
    });
  };

  if (profileQuery.isLoading
    || applicationsQuery.isLoading
    || (!isHrAdmin && badgeRemovalQuery.isLoading)) {
    return <LoadingSkeleton rows={3} height={28} />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState message={errorMessage(profileQuery.error)} onRetry={() => void profileQuery.refetch()} />;
  }
  if (applicationsQuery.isError || !applicationsQuery.data) {
    return (
      <ErrorState
        message="Unable to load your mentor request history."
        onRetry={() => void applicationsQuery.refetch()}
      />
    );
  }
  if (!isHrAdmin && badgeRemovalQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your mentor badge removal request."
        onRetry={() => void badgeRemovalQuery.refetch()}
      />
    );
  }

  const committedTrainees = profileQuery.data.activeTrainees + profileQuery.data.pendingTrainees;
  const capacityLimit = Math.max(1, maxConcurrentTrainees);
  const capacityPercent = Math.min(100, Math.round((committedTrainees / capacityLimit) * 100));
  const remainingCapacity = Math.max(0, capacityLimit - committedTrainees);
  const skillAdditionRequests = (applicationsQuery.data ?? []).filter(
    (application) => application.applicationType === 'SKILL_ADDITION'
  );
  const profileUpdateRequests = (applicationsQuery.data ?? []).filter(
    (application) => application.applicationType === 'PROFILE_UPDATE'
  );
  const pendingProfileUpdate = profileUpdateRequests.find((application) => application.status === 'PENDING');
  const latestProfileUpdate = profileUpdateRequests[0];
  const profileApplicationNote = parseProfileNote(profileQuery.data.profileApplicationDetails);
  const educationRecords = parseProfileRecords(profileApplicationNote['Educational background']);
  const professionalCertificates = parseProfileRecords(profileApplicationNote['Professional certificates']);
  const mentorshipHistory = parseProfileRecords(profileApplicationNote['Previous mentorship experience']);
  const careerHistory = parseProfileRecords(profileApplicationNote['General professional experience']);
  const mentoringInterests = parseProfileList(profileApplicationNote['Mentoring interests / expertise']);
  const availability = parseProfileAvailability(profileQuery.data.availabilityNotes)
    ?? parseProfileAvailability(profileApplicationNote.Availability);
  const mentorshipFormats = availability?.formats.length
    ? availability.formats
    : parseProfileList(profileApplicationNote['Mentorship formats']);
  const pendingSkillIds = new Set(
    skillAdditionRequests
      .filter((application) => application.status === 'PENDING')
      .flatMap((application) => application.catalogSkillIds)
  );
  const currentSkillIds = new Set(profileQuery.data.skills.map((skill) => skill.id));
  const availableSkills = activeSkills.filter(
    (skill) => !currentSkillIds.has(skill.id) && !pendingSkillIds.has(skill.id)
  );
  const pendingCustomSkills = new Set(
    skillAdditionRequests
      .filter((application) => application.status === 'PENDING')
      .map((application) => application.customSkill?.trim().toLowerCase())
      .filter((skill): skill is string => Boolean(skill))
  );

  const submitSkillRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (skillIds.length === 0 && !customSkill.trim()) {
      pushToast({
        title: 'Select a skill',
        message: 'Choose one or more skills or enter a custom skill to request.',
        tone: 'info',
      });
      return;
    }
    if (customSkill.trim() && pendingCustomSkills.has(customSkill.trim().toLowerCase())) {
      pushToast({
        title: 'Skill request already pending',
        message: 'This custom skill is already awaiting HR review.',
        tone: 'info',
      });
      return;
    }
    if (skillEvidence.length === 0) {
      pushToast({
        title: 'Supporting evidence required',
        message: 'Upload evidence for the requested mentor skills.',
        tone: 'err',
      });
      return;
    }
    skillRequestMutation.mutate({
      catalogSkillIds: skillIds.map(Number),
      customSkill: customSkill.trim() || undefined,
      supportingEvidence: skillEvidence,
      note: skillRequestNote.trim() || undefined,
    });
  };

  const downloadProfileEvidence = async (fileId: number, fileName: string) => {
    setDownloadingProfileEvidenceId(fileId);
    try {
      const blob = await mentorApplicationApi.downloadProofDocument(fileId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      pushToast({
        title: 'Unable to download application document',
        message: errorMessage(error),
        tone: 'err',
      });
    } finally {
      setDownloadingProfileEvidenceId(null);
    }
  };

  return (
    <div className="apid-card boa-stack">
      <section className="boa-stack" aria-labelledby="mentor-profile-picture-title">
        <div>
          <h3 id="mentor-profile-picture-title" className="boa-card-title">Profile picture</h3>
          <p className="boa-card-subtitle">
            Picture changes take effect immediately and do not need HR approval.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt="Your mentor profile"
              style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              aria-label="No profile picture uploaded"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'var(--surface-subtle, #f8fafc)',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              <Award size={28} />
            </div>
          )}
          <label className="apid-field" style={{ maxWidth: 360 }}>
            Change picture
            <input
              className="apid-input"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => {
                const image = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (image) {
                  if (image.size > 5 * 1024 * 1024) {
                    pushToast({
                      title: 'Picture is too large',
                      message: 'Choose an image that is 5 MB or smaller.',
                      tone: 'err',
                    });
                    return;
                  }
                  setProfilePictureFile(image);
                  profilePictureMutation.mutate(image);
                }
              }}
              disabled={profilePictureMutation.isPending}
            />
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              PNG or JPG up to 5 MB.
            </span>
          </label>
          {profilePictureMutation.isPending && <span className="boa-muted">Uploading picture…</span>}
        </div>
      </section>

      {pendingProfileUpdate && (
        <div className="apid-card boa-stack" role="status" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <strong>Profile update awaiting HR review</strong>
            <StatusPill label="Pending review" tone="warn" />
          </div>
          <p className="boa-muted" style={{ margin: 0 }}>
            Your approved profile remains visible until HR makes a decision. A second request cannot be submitted while this one is pending.
          </p>
        </div>
      )}
      {!pendingProfileUpdate && latestProfileUpdate?.status === 'DECLINED' && (
        <div className="apid-card boa-stack" role="status" style={{ marginBottom: 0 }}>
          <strong>Previous profile update was declined</strong>
          {latestProfileUpdate.reviewReason && (
            <p className="boa-muted" style={{ margin: 0 }}>HR note: {latestProfileUpdate.reviewReason}</p>
          )}
          <p className="boa-muted" style={{ margin: 0 }}>You can revise your details and submit a new request.</p>
        </div>
      )}

      <form className="boa-stack" onSubmit={submit}>
        <div className="boa-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--primary-soft, #eef2ff)',
                color: 'var(--primary, #4338ca)',
              }}
            >
              <Award size={21} />
            </span>
            <div>
              <h2 className="boa-card-title">Public profile details</h2>
              <p className="boa-card-subtitle">These details help employees decide whether your mentoring style and schedule fit their needs.</p>
            </div>
          </div>
          <StatusPill label="Active mentor" tone="ok" />
        </div>
        <div
          className="apid-card"
          style={{ padding: '1rem', background: 'var(--surface-subtle, #f8fafc)', borderColor: 'var(--border)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <strong>Mentoring capacity</strong>
              <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                {profileQuery.data.activeTrainees} active · {profileQuery.data.pendingTrainees} pending · {remainingCapacity} available
              </div>
            </div>
            <strong>{committedTrainees} / {capacityLimit}</strong>
          </div>
          <progress
            aria-label="Current mentoring capacity"
            max={capacityLimit}
            value={Math.min(committedTrainees, capacityLimit)}
            style={{ width: '100%', height: 8, marginTop: '0.7rem', accentColor: 'var(--primary, #4338ca)' }}
          />
          <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
            {capacityPercent}% of your available trainee capacity is committed.
          </span>
        </div>

        <section className="apid-card boa-stack" aria-labelledby="mentor-approved-application-title">
          <div>
            <h3 id="mentor-approved-application-title" className="boa-card-title">Approved application details</h3>
            <p className="boa-card-subtitle">
              These are the sections and information from your approved mentor application.
            </p>
          </div>
          {!profileQuery.data.profileApplicationDetails ? (
            <EmptyState
              title="No application details available"
              description="Your mentor profile was not created from a submitted mentor application."
            />
          ) : (
            <>
              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">Educational background</h4>
                {educationRecords.length === 0 ? <span className="boa-muted">No education records provided.</span> : (
                  educationRecords.map((education, index) => {
                    const certificateUrl = safeProfileUrl(education.certificateLink);
                    return (
                      <article className="mentor-application-record" key={`${String(education.institution)}-${index}`}>
                        <strong>{profileNoteText(education.educationLevel)}</strong>
                        <dl>
                          <div><dt>Field of study</dt><dd>{profileNoteText(education.fieldOfStudy)}</dd></div>
                          <div><dt>Institution</dt><dd>{profileNoteText(education.institution)}</dd></div>
                          {(typeof education.certificateDocument === 'string' && education.certificateDocument) && (
                            <div><dt>Certificate document</dt><dd>{education.certificateDocument}</dd></div>
                          )}
                          {certificateUrl && (
                            <div><dt>Certificate link</dt><dd>
                              <a href={certificateUrl} target="_blank" rel="noreferrer">Open certificate</a>
                            </dd></div>
                          )}
                        </dl>
                      </article>
                    );
                  })
                )}
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">What I want to mentor</h4>
                {mentoringInterests.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {mentoringInterests.map((skill) => <StatusPill key={skill} label={skill} tone="neutral" />)}
                  </div>
                ) : <span className="boa-muted">No mentoring interests provided.</span>}
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">Professional certificates</h4>
                {professionalCertificates.length === 0 ? <span className="boa-muted">No certificates provided.</span> : (
                  professionalCertificates.map((certificate, index) => {
                    const certificateUrl = safeProfileUrl(certificate.link);
                    return (
                      <article className="mentor-application-record" key={`${String(certificate.title)}-${index}`}>
                        <strong>{profileNoteText(certificate.title)}</strong>
                        {typeof certificate.document === 'string' && certificate.document && (
                          <p>Certificate document: {certificate.document}</p>
                        )}
                        {certificateUrl && (
                          <a href={certificateUrl} target="_blank" rel="noreferrer">Open certificate</a>
                        )}
                        {Array.isArray(certificate.skills) && certificate.skills.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {certificate.skills.map((skill) => (
                              <StatusPill key={String(skill)} label={String(skill)} tone="neutral" />
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">Mentorship experience</h4>
                {mentorshipHistory.length === 0 ? (
                  <span className="boa-muted">
                    {profileNoteText(profileApplicationNote['Previous mentorship experience'])}
                  </span>
                ) : mentorshipHistory.map((experience, index) => {
                  const proofUrl = safeProfileUrl(experience.proofLink);
                  return (
                    <article className="mentor-application-record" key={`mentorship-${index}`}>
                      <strong>{profileNoteText(experience.role)}</strong>
                      <p>{[experience.organization, experience.years].filter(Boolean).join(' · ') || 'Details not provided'}</p>
                      {typeof experience.description === 'string' && experience.description && <p>{experience.description}</p>}
                      {typeof experience.proofDocument === 'string' && experience.proofDocument && (
                        <span>Proof document: {experience.proofDocument}</span>
                      )}
                      {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer">Open proof link</a>}
                    </article>
                  );
                })}
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">General professional experience</h4>
                {careerHistory.length === 0 ? <span className="boa-muted">No career history provided.</span> : (
                  careerHistory.map((experience, index) => (
                    <article className="mentor-application-record" key={`career-${index}`}>
                      <strong>{profileNoteText(experience.title)}</strong>
                      <p>{[experience.organization, experience.years].filter(Boolean).join(' · ') || 'Details not provided'}</p>
                      {typeof experience.description === 'string' && experience.description && <p>{experience.description}</p>}
                    </article>
                  ))
                )}
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">Mentorship preferences and availability</h4>
                {availability?.days.length ? (
                  <div className="mentor-availability-list">
                    {availability.days.map((day, index) => (
                      <div className="mentor-availability-item" key={`${day.day}-${index}`}>
                        <strong>{day.day}</strong>
                        <span>{day.start && day.end ? `${day.start}–${day.end}` : 'Time not specified'}</span>
                      </div>
                    ))}
                    {availability.timeZone && (
                      <span className="mentor-availability-timezone">
                        Time zone: {availability.timeZone.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                ) : <span className="boa-muted">No structured availability provided.</span>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {mentorshipFormats.map((format) => (
                    <StatusPill key={format} label={format} tone="neutral" />
                  ))}
                </div>
                <p style={{ margin: 0 }}>Maximum mentees: {profileQuery.data.maxConcurrentTrainees}</p>
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">CV and letter of motivation</h4>
                <p style={{ margin: 0 }}>CV: {profileNoteText(profileApplicationNote.CV?.split(' (')[0])}</p>
                <p style={{ margin: 0 }}>
                  Letter of motivation: {profileNoteText(profileApplicationNote['Letter of motivation']?.split(' (')[0])}
                </p>
              </section>

              <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
                <h4 className="boa-card-title">Application documents</h4>
                {profileQuery.data.profileApplicationEvidence?.length ? (
                  profileQuery.data.profileApplicationEvidence.map((evidence) => (
                    <div
                      key={evidence.fileId}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}
                    >
                      <span><strong>{evidence.context}</strong> · {evidence.fileName}</span>
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline apid-btn-sm"
                        disabled={downloadingProfileEvidenceId !== null}
                        onClick={() => void downloadProfileEvidence(evidence.fileId, evidence.fileName)}
                      >
                        {downloadingProfileEvidenceId === evidence.fileId ? 'Downloading…' : 'Download'}
                      </button>
                    </div>
                  ))
                ) : <span className="boa-muted">No uploaded application documents.</span>}
              </section>
            </>
          )}
        </section>

        <div className="boa-grid-2" style={{ marginBottom: 0 }}>
          <label className="apid-field">
            Years of experience
            <input
              className="apid-input"
              type="number"
              min={0}
              step={1}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            />
          </label>
          <label className="apid-field">
            Mentoring approach
            <textarea
              className="apid-input"
              rows={4}
              maxLength={2000}
              value={mentoringApproach}
              onChange={(event) => setMentoringApproach(event.target.value)}
              placeholder="Describe how you guide, teach, and support your mentees."
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            />
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              {mentoringApproach.length} / 2000 characters
            </span>
          </label>
          <label className="apid-field">
            Sessions per week
            <input
              className="apid-input"
              type="number"
              min={0}
              step={1}
              value={sessionsPerWeek}
              onChange={(event) => setSessionsPerWeek(event.target.value)}
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            />
          </label>
          <label className="apid-field">
            Availability notes
            <textarea
              className="apid-input"
              rows={3}
              maxLength={1000}
              value={availabilityNotes}
              onChange={(event) => setAvailabilityNotes(event.target.value)}
              placeholder="Share your typical mentoring availability."
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            />
          </label>
        </div>

        <div className="boa-grid-2" style={{ alignItems: 'end', marginBottom: 0 }}>
          <label className="apid-field">
            Maximum concurrent trainees
            <input
              className="apid-input"
              type="number"
              min={1}
              max={100}
              required
              value={maxConcurrentTrainees}
              onChange={(event) => setMaxConcurrentTrainees(Number(event.target.value))}
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            />
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              Must be at least your current active and pending load.
            </span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={profileUpdateMutation.isPending || Boolean(pendingProfileUpdate)}
            >
              <Save size={15} />
              {profileUpdateMutation.isPending ? 'Sending request…' : 'Request profile update'}
            </button>
          </div>
        </div>
        <p className="boa-muted" style={{ margin: 0 }}>
          Profile detail changes are applied only after HR approval.
        </p>
      </form>

      {!isHrAdmin && (
        <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
          <div>
            <h3 className="boa-card-title">Remove my mentor badge</h3>
            <p className="boa-card-subtitle">
              Submit a request for HR review. This option is available regardless of how many mentoring skills you have.
              Your badge and pairings will not change until HR decides.
            </p>
          </div>
          {badgeRemovalQuery.data?.status === 'PENDING' ? (
            <div className="boa-stack">
              <StatusPill label="Pending HR review" tone="warn" />
              {badgeRemovalQuery.data.reason && (
                <p className="boa-muted" style={{ margin: 0 }}>{badgeRemovalQuery.data.reason}</p>
              )}
            </div>
          ) : badgeRemovalQuery.data?.status === 'APPROVED' ? (
            <div className="boa-stack">
              <StatusPill label="Approved" tone="ok" />
              <p className="boa-muted" style={{ margin: 0 }}>
                {badgeRemovalQuery.data.disposition === 'REVOKE_ALL_PAIRINGS'
                  ? 'Your mentor authorization and existing pairings were closed.'
                  : 'Existing pairings remain active, but new matches and pending requests were cancelled.'}
              </p>
              {badgeRemovalQuery.data.decisionReason && (
                <p className="boa-muted" style={{ margin: 0 }}>HR note: {badgeRemovalQuery.data.decisionReason}</p>
              )}
            </div>
          ) : (
            <div className="boa-stack">
              {badgeRemovalQuery.data?.status === 'DECLINED' && (
                <div className="boa-stack">
                  <StatusPill label="Previously declined" tone="neutral" />
                  {badgeRemovalQuery.data.decisionReason && (
                    <p className="boa-muted" style={{ margin: 0 }}>HR note: {badgeRemovalQuery.data.decisionReason}</p>
                  )}
                  <p className="boa-muted" style={{ margin: 0 }}>
                    Your mentor badge is unchanged. You may submit another request if needed.
                  </p>
                </div>
              )}
              <label className="apid-field">
                Reason (optional)
                <textarea
                  className="apid-input"
                  rows={3}
                  maxLength={1000}
                  value={badgeRemovalReason}
                  onChange={(event) => setBadgeRemovalReason(event.target.value)}
                  disabled={badgeRemovalMutation.isPending}
                  placeholder="Add context for HR"
                />
              </label>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={badgeRemovalMutation.isPending}
                onClick={() => badgeRemovalMutation.mutate(badgeRemovalReason.trim() || undefined)}
              >
                {badgeRemovalMutation.isPending ? 'Sending request…' : 'Request mentor badge removal'}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
        <div>
          <h3 className="boa-card-title">
            Request additional mentoring skills
          </h3>
          <p className="boa-card-subtitle">
            Select new skills and submit supporting evidence. HR approval is required before you can mentor them.
          </p>
        </div>
        <div className="boa-stack">
          <strong>Approved skills</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {profileQuery.data.skills.length > 0
              ? profileQuery.data.skills.map((skill) => (
                  <StatusPill key={skill.id} label={skill.name} tone="ok" />
                ))
              : <span className="boa-muted">No active mentor skills.</span>}
          </div>
        </div>
        {skillAdditionRequests.length > 0 && (
          <div className="boa-stack" aria-label="Skill request history">
            <strong>Skill request history</strong>
            {skillAdditionRequests.map((application) => (
              <div
                key={application.id}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}
              >
                <span>{application.skillName || 'Skill request'}</span>
                <StatusPill
                  label={application.status}
                  tone={application.status === 'APPROVED' ? 'ok' : application.status === 'DECLINED' ? 'err' : 'warn'}
                />
                {application.reviewReason && <span className="boa-muted">{application.reviewReason}</span>}
              </div>
            ))}
          </div>
        )}
        {availableSkills.length === 0 && !customSkill.trim() ? (
          <EmptyState
            title="No additional catalog skills available"
            description="Your current and pending skills are already listed. You can still request a custom skill below."
          />
        ) : null}
        <form className="apid-form" onSubmit={submitSkillRequest}>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition">Catalog skills</label>
            <select
              id="mentor-skill-addition"
              className="apid-input"
              multiple
              size={Math.min(6, Math.max(3, availableSkills.length))}
              value={skillIds}
              onChange={(event) => setSkillIds(
                Array.from(event.target.selectedOptions, (option) => option.value)
              )}
              disabled={skillRequestMutation.isPending || availableSkills.length === 0}
            >
              {availableSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              Hold Ctrl or Command to select multiple skills.
            </span>
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-custom">Custom skill (optional)</label>
            <input
              id="mentor-skill-addition-custom"
              className="apid-input"
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              maxLength={150}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-evidence">Supporting evidence</label>
            <input
              id="mentor-skill-addition-evidence"
              type="file"
              className="apid-input"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              multiple
              required
              onChange={(event) => setSkillEvidence(Array.from(event.target.files ?? []))}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-note">Note (optional)</label>
            <textarea
              id="mentor-skill-addition-note"
              className="apid-input"
              rows={3}
              value={skillRequestNote}
              onChange={(event) => setSkillRequestNote(event.target.value)}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <button
            type="submit"
            className="apid-btn apid-btn-primary"
            disabled={skillRequestMutation.isPending || (availableSkills.length === 0 && !customSkill.trim())}
          >
            {skillRequestMutation.isPending ? 'Sending request…' : 'Request skill approval'}
          </button>
        </form>
      </section>
    </div>
  );
}
