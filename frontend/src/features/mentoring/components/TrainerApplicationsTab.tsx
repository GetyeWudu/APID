import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { DataSourceBadge, EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import type { MentorApplication } from '../api/mentorApplicationApi';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import './TrainerApplicationsTab.css';

type ApplicationNoteRecord = Record<string, unknown>;
type ApplicationStatusFilter = 'ALL' | MentorApplication['status'];

function parseApplicationNote(note: string | null) {
  const values: Record<string, string> = {};
  note?.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator > 0) {
      values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  });
  return values;
}

function parseNoteRecords(value: string | undefined): ApplicationNoteRecord[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((record): record is ApplicationNoteRecord =>
        Boolean(record) && typeof record === 'object' && !Array.isArray(record))
      : [];
  } catch {
    return [];
  }
}

function parseAvailability(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const availability = parsed as Record<string, unknown>;
      const days = Array.isArray(availability.days)
        ? availability.days.filter((entry): entry is ApplicationNoteRecord =>
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
    }
  } catch {
    // Older applications store availability as a display string.
  }

  const formatsMatch = value.match(/;\s*Formats:\s*(.*)$/i);
  const formatsEnd = formatsMatch?.index ?? value.length;
  const availabilityText = formatsMatch ? value.slice(0, formatsEnd).trim() : value;
  const timeZoneMatch = availabilityText.match(/\(([^()]*)\)\s*$/);
  const scheduleEnd = timeZoneMatch?.index ?? availabilityText.length;
  const schedule = availabilityText.slice(0, scheduleEnd).trim();
  const days = schedule.split(/,\s*/).flatMap((entry) => {
    const separator = entry.indexOf(':');
    if (separator < 0) return [];
    const day = entry.slice(0, separator).trim();
    const range = entry.slice(separator + 1).trim();
    const rangeMatch = range.match(/^(.*?)\s*[–-]\s*(.*?)$/);
    const normalizeTime = (time: string | undefined) =>
      time && !['undefined', 'null'].includes(time.trim().toLowerCase()) ? time.trim() : '';
    return [{
      day,
      start: normalizeTime(rangeMatch?.[1]),
      end: normalizeTime(rangeMatch?.[2]),
    }];
  });
  return {
    days,
    timeZone: timeZoneMatch?.[1] ?? '',
    formats: splitCommaSeparated(formatsMatch?.[1]),
  };
}

function documentName(value: string | undefined) {
  return value?.replace(/\s+\(\d+(?:\.\d+)?\s*(?:KB|MB)\)$/i, '').trim() ?? '';
}

function evidenceContextFromNote(note: string | null, fileName: string) {
  const details = parseApplicationNote(note);
  const references: Array<{ label: string; fileName: string }> = [];
  const addReference = (label: string, name: unknown) => {
    if (typeof name === 'string' && name.trim()) references.push({ label, fileName: name.trim() });
  };
  addReference('Curriculum vitae', documentName(details.CV));
  addReference('Letter of motivation', documentName(details['Letter of motivation']));
  addReference('Profile picture', details['Profile picture']);
  parseNoteRecords(details['Educational background']).forEach((education, index) => {
    const qualification = [education.educationLevel, education.institution]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .join(' · ');
    addReference(
      `Education background ${index + 1}${qualification ? `: ${qualification}` : ''}`,
      education.certificateDocument
    );
  });
  parseNoteRecords(details['Professional certificates']).forEach((certificate, index) =>
    addReference(
      `Professional certificate ${index + 1}${typeof certificate.title === 'string' && certificate.title.trim()
        ? `: ${certificate.title.trim()}`
        : ''}`,
      certificate.document
    )
  );
  parseNoteRecords(details['Previous mentorship experience']).forEach((experience, index) => {
    const mentorship = [experience.role, experience.organization]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .join(' · ');
    addReference(
      `Mentorship experience ${index + 1} proof${mentorship ? `: ${mentorship}` : ''}`,
      experience.proofDocument
    );
  });
  const matches = references
    .filter((reference) => reference.fileName === fileName)
    .map((reference) => reference.label);
  const uniqueMatches = [...new Set(matches)];
  if (uniqueMatches.length > 1) {
    return `Same filename referenced by: ${uniqueMatches.join(', ')}`;
  }
  return uniqueMatches[0] ?? 'Supporting evidence';
}

function noteText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

function splitCommaSeparated(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
  } catch {
    // Older applications store lists as comma-separated text.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || 'M';
}

function externalLink(value: unknown, label: string): ReactNode {
  if (typeof value !== 'string' || !value.trim()) return 'Not provided';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value;
    return (
      <a href={url.href} target="_blank" rel="noreferrer">
        {label} <ExternalLink size={13} />
      </a>
    );
  } catch {
    return value;
  }
}

function ApplicationDetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mentor-application-detail-section">
      <h4>{icon}{title}</h4>
      {children}
    </section>
  );
}

export function TrainerApplicationsTab({
  applications,
}: {
  applications: MentorApplication[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [previewTarget, setPreviewTarget] = useState<{
    fileName: string;
    objectUrl: string;
    contentType: string;
  } | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<MentorApplication | null>(null);
  const [detailTarget, setDetailTarget] = useState<MentorApplication | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatusFilter>('ALL');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  useEffect(() => () => {
    if (previewTarget) URL.revokeObjectURL(previewTarget.objectUrl);
  }, [previewTarget]);

  const handleDownloadEvidence = async (fileId: number, fileName: string) => {
    setDownloadingId(fileId);
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
        title: 'Unable to download certificate',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : error instanceof Error ? error.message : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewEvidence = async (fileId: number, fileName: string) => {
    setViewingId(fileId);
    try {
      const blob = await mentorApplicationApi.downloadProofDocument(fileId);
      setPreviewTarget({
        fileName,
        objectUrl: URL.createObjectURL(blob),
        contentType: blob.type,
      });
    } catch (error) {
      pushToast({
        title: 'Unable to view certificate',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : error instanceof Error ? error.message : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setViewingId(null);
    }
  };

  const handleApprove = async (application: MentorApplication) => {
    setBusyId(application.id);
    try {
      await mentorApplicationApi.review(application.id, { decision: 'APPROVED' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainer-profile'] }),
      ]);
      pushToast(application.applicationType === 'SKILL_ADDITION'
        ? {
            title: 'Skill request approved',
            message: `The approved skills were added to ${application.applicantUsername}'s mentor profile.`,
            tone: 'ok',
          }
        : application.applicationType === 'PROFILE_UPDATE'
          ? {
              title: 'Profile update approved',
              message: `${application.applicantUsername}'s mentor profile has been updated.`,
              tone: 'ok',
            }
        : {
            title: 'Application approved',
            message: `${application.applicantUsername} is now an approved mentor.`,
            tone: 'ok',
          });
    } catch (error) {
      pushToast({
        title: 'Unable to approve application',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (event: FormEvent) => {
    event.preventDefault();
    if (!decisionTarget) return;
    if (!reason.trim()) {
      setReasonError('A reason is required when declining an application.');
      return;
    }

    setBusyId(decisionTarget.id);
    try {
      await mentorApplicationApi.review(decisionTarget.id, {
        decision: 'DECLINED',
        reason: reason.trim(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
      ]);
      pushToast({
        title: decisionTarget.applicationType === 'SKILL_ADDITION'
          ? 'Skill request declined'
          : decisionTarget.applicationType === 'PROFILE_UPDATE'
            ? 'Profile update declined'
            : 'Application declined',
        message: `${decisionTarget.applicantUsername} has been notified of the decision.`,
        tone: 'info',
      });
      setDecisionTarget(null);
      setReason('');
      setReasonError('');
    } catch (error) {
      pushToast({
        title: 'Unable to decline application',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status: MentorApplication['status']) => {
    if (status === 'APPROVED') return <StatusPill label="APPROVED" tone="ok" />;
    if (status === 'DECLINED') return <StatusPill label="DECLINED" tone="err" />;
    return <StatusPill label="PENDING REVIEW" tone="warn" />;
  };
  const detailNote = parseApplicationNote(detailTarget?.note ?? null);
  const educationRecords = parseNoteRecords(detailNote['Educational background']);
  const professionalCertificates = parseNoteRecords(detailNote['Professional certificates']);
  const mentorshipHistory = parseNoteRecords(detailNote['Previous mentorship experience']);
  const careerHistory = parseNoteRecords(detailNote['General professional experience']);
  const availability = parseAvailability(detailNote.Availability ?? detailTarget?.availabilityNotes ?? undefined);
  const mentoringSkills = splitCommaSeparated(detailNote['Mentoring interests / expertise']);
  const mentorshipFormats = splitCommaSeparated(
    detailNote['Mentorship formats'] || availability?.formats.join(', ')
  );
  const detailEvidence = detailTarget
    ? (detailTarget.evidenceFiles?.length
      ? detailTarget.evidenceFiles
      : detailTarget.proofFileName
        && detailTarget.proofFileId !== null
        ? [{
          fileId: detailTarget.proofFileId,
          fileName: detailTarget.proofFileName,
          context: 'Supporting evidence',
        }]
        : [])
    : [];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredApplications = applications.filter((application) => {
    if (statusFilter !== 'ALL' && application.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    const searchableText = [
      application.applicantUsername,
      application.applicationType,
      application.expertiseSummary,
      application.note,
      application.mentoringApproach,
      application.availabilityNotes,
      ...(application.skillNames ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    return searchableText.includes(normalizedSearch);
  });
  const statusCounts = {
    ALL: applications.length,
    PENDING: applications.filter((application) => application.status === 'PENDING').length,
    APPROVED: applications.filter((application) => application.status === 'APPROVED').length,
    DECLINED: applications.filter((application) => application.status === 'DECLINED').length,
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Mentor Applications</h3>
          <p className="boa-card-subtitle">
            Scan applicants and status here; open an application to review qualifications and evidence.
          </p>
        </div>
        <DataSourceBadge source="live" />
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No Mentor Applications"
          description="No mentor applications have been submitted."
        />
      ) : (
        <div className="mentor-application-list">
          <div className="mentor-application-list-controls">
            <label className="mentor-application-search">
              <input
                type="search"
                className="apid-input"
                aria-label="Search applications"
                value={searchQuery}
                placeholder="Search applicants or skills"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="mentor-application-filters" aria-label="Filter applications by status">
              {(['ALL', 'PENDING', 'APPROVED', 'DECLINED'] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={`mentor-application-filter${statusFilter === filter ? ' is-active' : ''}`}
                  aria-pressed={statusFilter === filter}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === 'ALL' ? 'All' : filter === 'PENDING' ? 'Pending' : filter === 'APPROVED' ? 'Approved' : 'Declined'}
                  <span>{statusCounts[filter]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <EmptyState
              title="No matching applications"
              description="Try a different search or status filter."
            />
          ) : (
            <div className="apid-table-wrap mentor-application-table-wrap">
              <table className="apid-table mentor-application-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Request</th>
                    <th>Mentoring skills</th>
                    <th>Evidence</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => {
                    const skills = app.skillNames?.length ? app.skillNames : [app.skillName].filter(Boolean);
                    const evidenceCount = app.evidenceFiles?.length || (app.proofFileName ? 1 : 0);
                    return (
                      <tr key={app.id}>
                        <td>
                          <strong className="mentor-application-applicant">{app.applicantUsername}</strong>
                          <span className="mentor-application-id">Application #{app.id}</span>
                        </td>
                        <td>
                          <span className="mentor-application-request-type">
                            {app.applicationType === 'SKILL_ADDITION'
                              ? 'Skill addition'
                              : app.applicationType === 'PROFILE_UPDATE'
                                ? 'Profile update'
                                : 'Mentor application'}
                          </span>
                        </td>
                        <td>
                          {app.applicationType === 'PROFILE_UPDATE'
                            ? <StatusPill label="Profile details" tone="neutral" />
                            : (
                              <div className="mentor-application-skill-list">
                                {skills.slice(0, 2).map((skillName) => (
                                  <StatusPill key={skillName} label={skillName} tone="neutral" />
                                ))}
                                {skills.length > 2 && (
                                  <span className="mentor-application-more-skills">+{skills.length - 2} more</span>
                                )}
                                {skills.length === 0 && <span className="boa-muted">Not provided</span>}
                              </div>
                            )}
                        </td>
                        <td>
                          <span className="mentor-application-evidence-count">
                            <FileText size={15} /> {evidenceCount} {evidenceCount === 1 ? 'file' : 'files'}
                          </span>
                        </td>
                        <td>{renderStatus(app.status)}</td>
                        <td>
                          <time dateTime={app.submittedAt}>
                            {new Date(app.submittedAt).toLocaleDateString()}
                            <span className="mentor-application-submitted-time">
                              {new Date(app.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </time>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm mentor-application-view-button"
                            onClick={() => setDetailTarget(app)}
                          >
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {detailTarget && (
        <div className="apid-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailTarget(null);
        }}>
          <div
            className="apid-card apid-modal mentor-application-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-application-detail-title"
          >
            <header className="mentor-application-detail-header">
              <div className="mentor-application-detail-person">
                <div className="mentor-application-detail-avatar" aria-hidden="true">
                  {getInitials(
                    noteText(detailNote['Full name']) === 'Not provided'
                      ? detailTarget.applicantUsername
                      : noteText(detailNote['Full name'])
                  )}
                </div>
                <div>
                <span className="mentor-application-detail-eyebrow">
                  {detailTarget.applicationType === 'SKILL_ADDITION'
                    ? 'Additional skills request'
                    : detailTarget.applicationType === 'PROFILE_UPDATE'
                      ? 'Mentor profile update'
                    : 'Mentor application'} · #{detailTarget.id}
                </span>
                <h3 id="mentor-application-detail-title">
                  {noteText(detailNote['Full name']) === 'Not provided'
                    ? detailTarget.applicantUsername
                    : noteText(detailNote['Full name'])}
                </h3>
                <p>{detailTarget.applicantUsername} · Submitted {new Date(detailTarget.submittedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="mentor-application-detail-header-actions">
                {renderStatus(detailTarget.status)}
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  aria-label="Close application details"
                  onClick={() => setDetailTarget(null)}
                >
                  <X size={15} />
                </button>
              </div>
            </header>

            {detailTarget.applicationType !== 'SKILL_ADDITION' && (
              <div className="mentor-application-detail-summary" aria-label="Application summary">
                <div>
                  <span>Expertise</span>
                  <strong>{mentoringSkills.length} skills</strong>
                </div>
                <div>
                  <span>Education</span>
                  <strong>{educationRecords.length || 'No'} record{educationRecords.length === 1 ? '' : 's'}</strong>
                </div>
                <div>
                  <span>Certificates</span>
                  <strong>{professionalCertificates.length || 'No'} file{professionalCertificates.length === 1 ? '' : 's'}</strong>
                </div>
                <div>
                  <span>Capacity</span>
                  <strong>{noteText(detailNote['Maximum concurrent mentees'])} mentees</strong>
                </div>
              </div>
            )}

            <div className="mentor-application-detail-grid">
              {detailTarget.applicationType === 'PROFILE_UPDATE' && (
                <ApplicationDetailSection icon={<BriefcaseBusiness size={17} />} title="Requested profile changes">
                  <dl>
                    <div><dt>Requested changes</dt><dd>{noteText(detailNote['Requested changes'])}</dd></div>
                    <div><dt>Years of experience</dt><dd>{detailTarget.experienceYears ?? 'Not provided'}</dd></div>
                    <div><dt>Mentoring approach</dt><dd>{noteText(detailTarget.mentoringApproach)}</dd></div>
                    <div><dt>Availability notes</dt><dd>{noteText(detailTarget.availabilityNotes)}</dd></div>
                    <div><dt>Sessions per week</dt><dd>{detailTarget.sessionsPerWeek ?? 'Not provided'}</dd></div>
                    <div><dt>Maximum concurrent trainees</dt><dd>{noteText(detailNote['Maximum concurrent mentees'])}</dd></div>
                  </dl>
                </ApplicationDetailSection>
              )}
              {detailTarget.applicationType === 'SKILL_ADDITION' ? (
                <ApplicationDetailSection icon={<BriefcaseBusiness size={17} />} title="Requested skills">
                  <div className="mentor-application-detail-tags">
                    {(detailTarget.skillNames?.length ? detailTarget.skillNames : [detailTarget.skillName])
                      .filter(Boolean)
                      .map((skill) => <StatusPill key={skill} label={skill} tone="neutral" />)}
                  </div>
                </ApplicationDetailSection>
              ) : (
                <>
              <ApplicationDetailSection icon={<GraduationCap size={17} />} title="Educational background">
                {educationRecords.length === 0 ? (
                  <p className="boa-muted">No structured education details were provided.</p>
                ) : educationRecords.map((education, index) => (
                  <article className="mentor-application-record" key={`${String(education.institution)}-${index}`}>
                    <strong>{noteText(education.educationLevel)}</strong>
                    <dl>
                      <div><dt>Field of study</dt><dd>{noteText(education.fieldOfStudy)}</dd></div>
                      <div><dt>Institution</dt><dd>{noteText(education.institution)}</dd></div>
                      <div>
                        <dt>Certificate</dt>
                        <dd>
                          {education.certificateDocument
                            ? String(education.certificateDocument)
                            : externalLink(education.certificateLink, 'Open certificate')}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </ApplicationDetailSection>

              <ApplicationDetailSection icon={<BriefcaseBusiness size={17} />} title="Professional certificates">
                {professionalCertificates.length === 0 ? (
                  <p className="boa-muted">No professional certificates provided.</p>
                ) : professionalCertificates.map((certificate, index) => (
                  <article className="mentor-application-record" key={`${String(certificate.title)}-${index}`}>
                    <strong>{noteText(certificate.title)}</strong>
                    <p>
                      {certificate.document
                        ? String(certificate.document)
                        : externalLink(certificate.link, 'Open certificate')}
                    </p>
                    {Array.isArray(certificate.skills) && certificate.skills.length > 0 && (
                      <div className="mentor-application-detail-tags">
                        {certificate.skills.map((skill) => (
                          <StatusPill key={String(skill)} label={String(skill)} tone="neutral" />
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </ApplicationDetailSection>

              <ApplicationDetailSection icon={<BriefcaseBusiness size={17} />} title="Mentorship and career experience">
                <h5>Previous mentorship</h5>
                {mentorshipHistory.length > 0 ? mentorshipHistory.map((experience, index) => (
                  <article className="mentor-application-record" key={`mentorship-${index}`}>
                    <strong>{noteText(experience.role)}</strong>
                    <p>{[experience.organization, experience.years].filter(Boolean).join(' · ') || 'Details not provided'}</p>
                    {typeof experience.description === 'string' && experience.description && <p>{experience.description}</p>}
                    {typeof experience.proofLink === 'string' && experience.proofLink
                      && externalLink(experience.proofLink, 'Experience proof')}
                  </article>
                )) : <p className="boa-muted">{noteText(detailNote['Previous mentorship experience'])}</p>}
                <h5>Professional career</h5>
                {careerHistory.length > 0 ? careerHistory.map((experience, index) => (
                  <article className="mentor-application-record" key={`career-${index}`}>
                    <strong>{noteText(experience.title)}</strong>
                    <p>{[experience.organization, experience.years].filter(Boolean).join(' · ') || 'Details not provided'}</p>
                    {typeof experience.description === 'string' && experience.description && <p>{experience.description}</p>}
                  </article>
                )) : <p className="boa-muted">No career history provided.</p>}
              </ApplicationDetailSection>

              <ApplicationDetailSection icon={<CalendarDays size={17} />} title="Mentorship preferences">
                <div className="mentor-preference-stack">
                  <div className="mentor-preference-block">
                    <span className="mentor-preference-label">Skills and expertise</span>
                    {mentoringSkills.length > 0 ? (
                      <div className="mentor-preference-tags">
                        {mentoringSkills.map((skill) => (
                          <StatusPill key={skill} label={skill} tone="neutral" />
                        ))}
                      </div>
                    ) : <span className="boa-muted">Not provided</span>}
                  </div>

                  <div className="mentor-preference-block">
                    <span className="mentor-preference-label">Availability</span>
                    {availability?.days.length ? (
                      <div className="mentor-availability-list">
                        {availability.days.map((day, index) => {
                          const timeRange = day.start && day.end
                            ? `${day.start}–${day.end}`
                            : day.start
                              ? `${day.start}–End time not set`
                              : day.end
                                ? `Start time not set–${day.end}`
                                : 'Time not specified';
                          return (
                            <div className="mentor-availability-item" key={`${day.day}-${index}`}>
                              <strong>{day.day}</strong>
                              <span>{timeRange}</span>
                            </div>
                          );
                        })}
                        {availability.timeZone && (
                          <span className="mentor-availability-timezone">
                            Time zone: {availability.timeZone.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    ) : <span className="boa-muted">Not provided</span>}
                  </div>

                  <div className="mentor-preference-bottom-grid">
                    <div className="mentor-preference-block">
                      <span className="mentor-preference-label">Mentorship formats</span>
                      {mentorshipFormats.length > 0 ? (
                        <div className="mentor-preference-tags">
                          {mentorshipFormats.map((format) => (
                            <span className="mentor-preference-format" key={format}>{format}</span>
                          ))}
                        </div>
                      ) : <span className="boa-muted">Not provided</span>}
                    </div>
                    <div className="mentor-capacity-card">
                      <span className="mentor-preference-label">Maximum mentees</span>
                      <strong>{noteText(detailNote['Maximum concurrent mentees'])}</strong>
                      <span className="boa-muted">at the same time</span>
                    </div>
                  </div>
                </div>
              </ApplicationDetailSection>

              <ApplicationDetailSection icon={<FileText size={17} />} title="Application documents">
                <div className="mentor-application-document-grid">
                  {[
                    { label: 'Curriculum vitae', value: detailNote.CV },
                    { label: 'Letter of motivation', value: detailNote['Letter of motivation'] },
                    { label: 'Profile picture', value: detailNote['Profile picture'] },
                  ].map((document) => (
                    <article className="mentor-application-document" key={document.label}>
                      <div className="mentor-application-document-icon"><FileText size={16} /></div>
                      <div>
                        <span>{document.label}</span>
                        <strong>{typeof document.value === 'string'
                          ? document.value.split(' (')[0]
                          : 'Not provided'}</strong>
                      </div>
                    </article>
                  ))}
                </div>
                {detailEvidence.length > 0 && (
                  <div className="mentor-application-evidence-list">
                    <h5>Uploaded evidence</h5>
                    {detailEvidence.map((evidence) => (
                      <div className="mentor-application-evidence-item" key={evidence.fileId}>
                        <div className="mentor-application-evidence-description">
                          <span className="mentor-application-evidence-context">
                            {evidence.context && evidence.context !== 'Supporting evidence'
                              ? evidence.context
                              : evidenceContextFromNote(detailTarget.note, evidence.fileName)}
                          </span>
                          <span className="mentor-application-evidence-name">
                            <FileText size={14} />{evidence.fileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          disabled={viewingId !== null}
                          onClick={() => void handleViewEvidence(evidence.fileId, evidence.fileName)}
                        >
                          <Eye size={13} />{viewingId === evidence.fileId ? 'Opening…' : 'View'}
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          disabled={downloadingId !== null}
                          onClick={() => void handleDownloadEvidence(evidence.fileId, evidence.fileName)}
                        >
                          <Download size={13} />{downloadingId === evidence.fileId ? 'Downloading…' : 'Download'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ApplicationDetailSection>
                </>
              )}

              <ApplicationDetailSection icon={<Users size={17} />} title="Review">
                <dl>
                  <div><dt>Status</dt><dd>{renderStatus(detailTarget.status)}</dd></div>
                  <div><dt>Reviewed by</dt><dd>{noteText(detailTarget.reviewedByUsername)}</dd></div>
                  {detailTarget.reviewReason && (
                    <div><dt>Review reason</dt><dd>{detailTarget.reviewReason}</dd></div>
                  )}
                </dl>
              </ApplicationDetailSection>
            </div>
            <footer className="mentor-application-detail-footer">
              {detailTarget.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    className="apid-btn apid-btn-primary"
                    disabled={busyId !== null}
                    onClick={() => void handleApprove(detailTarget)}
                  >
                    <Check size={14} /> {detailTarget.applicationType === 'PROFILE_UPDATE' ? 'Approve update' : 'Approve application'}
                  </button>
                  <button
                    type="button"
                    className="apid-btn apid-btn-danger"
                    disabled={busyId !== null}
                    onClick={() => {
                      setDecisionTarget(detailTarget);
                      setReason('');
                      setReasonError('');
                      setDetailTarget(null);
                    }}
                  >
                    <XCircle size={14} /> {detailTarget.applicationType === 'PROFILE_UPDATE' ? 'Reject update' : 'Reject application'}
                  </button>
                </>
              )}
              <button type="button" className="apid-btn apid-btn-outline" onClick={() => setDetailTarget(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {previewTarget && (
        <div className="apid-modal-backdrop">
          <div
            className="apid-card apid-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-evidence-preview-title"
            style={{ maxWidth: 900 }}
          >
            <div className="boa-card-header">
              <div>
                <h3 id="mentor-evidence-preview-title" className="boa-card-title">
                  Certificate evidence
                </h3>
                <p className="boa-card-subtitle">{previewTarget.fileName}</p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                aria-label="Close certificate preview"
                onClick={() => setPreviewTarget(null)}
              >
                <X size={15} />
              </button>
            </div>
            {previewTarget.contentType === 'application/pdf' ? (
              <iframe
                title={previewTarget.fileName}
                src={previewTarget.objectUrl}
                style={{ width: '100%', height: '70vh', border: 0 }}
              />
            ) : previewTarget.contentType.startsWith('image/') ? (
              <img
                src={previewTarget.objectUrl}
                alt={previewTarget.fileName}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto' }}
              />
            ) : (
              <p className="boa-muted">
                This file type cannot be previewed in the browser. Download the evidence to view it.
              </p>
            )}
            <div className="apid-modal-actions">
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewTarget.objectUrl;
                  link.download = previewTarget.fileName;
                  link.click();
                }}
              >
                <Download size={14} /> Download
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => setPreviewTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Decline mentor application"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>
              Decline {decisionTarget.applicationType === 'SKILL_ADDITION'
                ? 'Skill Request'
                : decisionTarget.applicationType === 'PROFILE_UPDATE'
                  ? 'Profile Update'
                  : 'Application'} #{decisionTarget.id}
            </h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem' }}>
              Applicant: <strong>{decisionTarget.applicantUsername}</strong>
            </p>
            <form onSubmit={handleDecline} className="apid-form">
              <div className="apid-field">
                <label htmlFor="mentor-application-decline-reason">Reason (required)</label>
                <textarea
                  id="mentor-application-decline-reason"
                  className="apid-input"
                  rows={4}
                  maxLength={750}
                  required
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError('');
                  }}
                  placeholder="Explain why this application is being declined."
                />
                {reasonError && (
                  <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {reasonError}
                  </div>
                )}
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={busyId !== null}
                  onClick={() => setDecisionTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-danger"
                  disabled={busyId === decisionTarget.id}
                >
                  {busyId === decisionTarget.id ? 'Declining…' : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

