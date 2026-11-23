import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Award,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Sparkles,
  X,
} from 'lucide-react';
import { ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import { extractApiErrorMessage, type ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import './ApplyForMentorForm.css';

const STEPS = [
  'Personal',
  'Education',
  'Mentoring Skills',
  'Professional Certificates',
  'Mentoring Experience',
  'Career Experience',
  'Mentorship Preferences',
  'CV & Motivation',
  'Review',
] as const;
const EDUCATION_LEVELS = [
  'High School',
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Other',
];
const MENTORING_SKILL_GROUPS: Record<string, string[]> = {
  'Software Engineering & IT': [
    'Frontend Development',
    'Backend Development',
    'Full-Stack Development',
    'Mobile Application Development',
    'Software Architecture',
    'API Development & Integration',
    'Database Design & Management',
    'DevOps & Cloud Computing',
    'Cybersecurity',
    'Software Testing & Quality Assurance',
  ],
  'Data & Artificial Intelligence': [
    'Data Science',
    'Data Analysis',
    'Machine Learning',
    'Artificial Intelligence',
    'Deep Learning',
    'Natural Language Processing (NLP)',
    'Data Engineering',
    'Business Intelligence',
  ],
  'Business & Management': [
    'Project Management',
    'Product Management',
    'Business Analysis',
    'Entrepreneurship',
    'Business Strategy',
    'Financial Management',
    'Human Resource Management',
    'Marketing & Digital Marketing',
    'Leadership & Team Management',
  ],
  'Design & Creativity': [
    'UI/UX Design',
    'Graphic Design',
    'Product Design',
    'Web Design',
    'Video Editing & Production',
    'Content Creation',
  ],
  'Professional & Career Development': [
    'Career Development',
    'Technical Interview Preparation',
    'Resume & Portfolio Development',
    'Communication Skills',
    'Public Speaking',
    'Research & Academic Writing',
    'Freelancing & Remote Work',
  ],
};

type EducationEntry = {
  educationLevel: string;
  fieldOfStudy: string;
  institution: string;
  link: string;
  file?: File;
};

type ProfessionalCertificateEntry = {
  name: string;
  link: string;
  file?: File;
  skillIds: string[];
  customSkill: string;
};

type MentorshipExperience = {
  role: string;
  organization: string;
  startYear: string;
  endYear: string;
  current: boolean;
  description: string;
  proofLink: string;
  proofFile?: File;
};

type CareerExperience = {
  title: string;
  organization: string;
  startYear: string;
  endYear: string;
  current: boolean;
  description: string;
  proofLink: string;
  proofFile?: File;
};

type ApplicationForm = {
  fullName: string;
  photo?: File;
  educationalBackgrounds: EducationEntry[];
  professionalCertificates: ProfessionalCertificateEntry[];
  hasMentorshipExperience: 'yes' | 'no' | '';
  mentorshipExperiences: MentorshipExperience[];
  careerExperiences: CareerExperience[];
  skillIds: string[];
  customSkill: string;
  experienceYears: string;
  sessionsPerWeek: string;
  mentoringApproach: string;
  cv?: File;
  motivationLetter?: File;
};

const EMPTY_FORM: ApplicationForm = {
  fullName: '',
  educationalBackgrounds: [],
  professionalCertificates: [],
  hasMentorshipExperience: '',
  mentorshipExperiences: [],
  careerExperiences: [],
  skillIds: [],
  customSkill: '',
  experienceYears: '',
  sessionsPerWeek: '',
  mentoringApproach: '',
};

function formatFileSize(file: File) {
  return file.size < 1024 * 1024
    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

type SubmittedApplicationRecord = Record<string, unknown>;

function parseSubmittedApplication(note: string) {
  const values: Record<string, string> = {};
  note.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator > 0) values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  });

  const parseRecords = (value: string | undefined): SubmittedApplicationRecord[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is SubmittedApplicationRecord =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
    } catch {
      return [];
    }
  };

  const parseList = (value: string | undefined) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // Values from older applications may use plain comma-separated text.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  };

  return {
    values,
    education: parseRecords(values['Educational background']),
    certificates: parseRecords(values['Professional certificates']),
    mentorship: parseRecords(values['Previous mentorship experience']),
    career: parseRecords(values['General professional experience']),
    skills: parseList(values['Mentoring interests / expertise']),
  };
}

function submittedText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasFileExtension(file: File, extensions: string[]) {
  const fileName = file.name.toLowerCase();
  return extensions.some((extension) => fileName.endsWith(`.${extension}`));
}

function EducationBackgroundFields({
  entries,
  onChange,
  disabled,
}: {
  entries: EducationEntry[];
  onChange: (entries: EducationEntry[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<EducationEntry>) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index
      ? { ...entry, ...patch }
      : entry));
  };

  return (
    <div className="boa-stack">
      {entries.length === 0 ? (
        <div className="apid-card" style={{ padding: '1rem' }}>
          <p className="boa-muted" style={{ margin: 0 }}>No education records added yet.</p>
        </div>
      ) : entries.map((entry, index) => (
        <fieldset key={index} className="apid-card" style={{ padding: '1rem', minWidth: 0 }}>
          <legend className="boa-muted">Education background {index + 1}</legend>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            aria-label={`Remove education background ${index + 1}`}
            onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            disabled={disabled}
          >
            <X size={14} /> Remove
          </button>
          <div className="apid-form" style={{ marginTop: '0.75rem' }}>
            <div className="apid-field">
              <label htmlFor={`education-${index}-level`}>Education level</label>
              <select id={`education-${index}-level`} className="apid-input"
                value={entry.educationLevel}
                onChange={(event) => update(index, { educationLevel: event.target.value })}
                disabled={disabled}>
                <option value="">Select education level</option>
                {EDUCATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div className="apid-field">
              <label htmlFor={`education-${index}-field`}>Field of study</label>
              <input id={`education-${index}-field`} className="apid-input" value={entry.fieldOfStudy}
                maxLength={200} onChange={(event) => update(index, { fieldOfStudy: event.target.value })}
                disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`education-${index}-institution`}>Institution name</label>
              <input id={`education-${index}-institution`} className="apid-input" value={entry.institution}
                maxLength={200} onChange={(event) => update(index, { institution: event.target.value })}
                disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`education-${index}-file`}>Certificate document</label>
              <input id={`education-${index}-file`} className="apid-input" type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onClick={(event) => { event.currentTarget.value = ''; }}
                onChange={(event) => update(index, { file: event.target.files?.[0] })}
                disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`education-${index}-link`}>Or certificate link</label>
              <input id={`education-${index}-link`} className="apid-input" type="url"
                value={entry.link} placeholder="https://"
                onChange={(event) => update(index, { link: event.target.value })}
                disabled={disabled} />
            </div>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="apid-btn apid-btn-outline apid-btn-sm"
        onClick={() => onChange([...entries, {
          educationLevel: '',
          fieldOfStudy: '',
          institution: '',
          link: '',
        }])}
        disabled={disabled}
      >
        Add Education Background
      </button>
    </div>
  );
}

function MentoringSkillChoices({
  activeSkills,
  selectedIds,
  customSkill,
  onChange,
  disabled,
  label,
}: {
  activeSkills: SkillItem[];
  selectedIds: string[];
  customSkill: string;
  onChange: (selectedIds: string[], customSkill: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [search, setSearch] = useState('');
  const skillsByName = new Map(activeSkills.map((skill) => [skill.name.toLowerCase(), skill]));
  const normalizedSearch = search.trim().toLowerCase();

  return (
    <div className="apid-field">
      <label>{label} (optional)</label>
      <input className="apid-input" type="search" value={search}
        placeholder="Search defined skills"
        onChange={(event) => setSearch(event.target.value)} disabled={disabled} />
      <div className="boa-stack" style={{ maxHeight: 230, overflowY: 'auto', padding: '0.5rem' }}>
        {Object.entries(MENTORING_SKILL_GROUPS).map(([category, names]) => {
          const matches = names.filter((name) => name.toLowerCase().includes(normalizedSearch));
          if (matches.length === 0) return null;
          return (
            <fieldset key={category} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700 }}>{category}</legend>
              {matches.map((name) => {
                const skill = skillsByName.get(name.toLowerCase());
                if (!skill) {
                  return (
                    <div key={name} className="boa-muted" style={{ fontSize: '0.82rem' }}>
                      {name} · catalog loading
                    </div>
                  );
                }
                const id = String(skill.id);
                return (
                  <label key={skill.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={selectedIds.includes(id)} disabled={disabled}
                      onChange={(event) => onChange(
                        event.target.checked
                          ? [...selectedIds, id]
                          : selectedIds.filter((selectedId) => selectedId !== id),
                        customSkill
                      )} />
                    {skill.name}
                  </label>
                );
              })}
            </fieldset>
          );
        })}
      </div>
      <label htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-custom`}>
        Add a custom skill (optional)
      </label>
      <input id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-custom`}
        className="apid-input" value={customSkill} maxLength={150}
        placeholder="Enter a skill not listed above"
        onChange={(event) => onChange(selectedIds, event.target.value)} disabled={disabled} />
    </div>
  );
}

function ProfessionalCertificateFields({
  entries,
  activeSkills,
  onChange,
  disabled,
}: {
  entries: ProfessionalCertificateEntry[];
  activeSkills: SkillItem[];
  onChange: (entries: ProfessionalCertificateEntry[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<ProfessionalCertificateEntry>) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index
      ? { ...entry, ...patch }
      : entry));
  };

  return (
    <div className="boa-stack">
      {entries.length === 0 ? (
        <div className="apid-card" style={{ padding: '1rem' }}>
          <p className="boa-muted" style={{ margin: 0 }}>No professional certificates added yet.</p>
        </div>
      ) : entries.map((entry, index) => (
        <fieldset key={index} className="apid-card" style={{ padding: '1rem', minWidth: 0 }}>
          <legend className="boa-muted">Professional certificate {index + 1}</legend>
          <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
            aria-label={`Remove professional certificate ${index + 1}`}
            onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            disabled={disabled}>
            <X size={14} /> Remove
          </button>
          <div className="apid-form" style={{ marginTop: '0.75rem' }}>
            <div className="apid-field">
              <label htmlFor={`professional-certificate-${index}-title`}>Certificate title</label>
              <input id={`professional-certificate-${index}-title`} className="apid-input"
                value={entry.name} maxLength={200}
                onChange={(event) => update(index, { name: event.target.value })} disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`professional-certificate-${index}-file`}>Certificate file (optional)</label>
              <input id={`professional-certificate-${index}-file`} className="apid-input" type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onClick={(event) => { event.currentTarget.value = ''; }}
                onChange={(event) => update(index, { file: event.target.files?.[0] })} disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`professional-certificate-${index}-link`}>Or certificate link (optional)</label>
              <input id={`professional-certificate-${index}-link`} className="apid-input" type="url"
                value={entry.link} placeholder="https://"
                onChange={(event) => update(index, { link: event.target.value })} disabled={disabled} />
            </div>
            <MentoringSkillChoices
              activeSkills={activeSkills}
              selectedIds={entry.skillIds}
              customSkill={entry.customSkill}
              onChange={(skillIds, customSkill) => update(index, { skillIds, customSkill })}
              disabled={disabled}
              label={`Skills gained from certificate ${index + 1}`}
            />
          </div>
        </fieldset>
      ))}
      <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
        onClick={() => onChange([...entries, {
          name: '',
          link: '',
          skillIds: [],
          customSkill: '',
        }])} disabled={disabled}>
        Add Professional Certificate
      </button>
    </div>
  );
}

function MentorshipExperienceFields({
  entries,
  onChange,
  disabled,
}: {
  entries: MentorshipExperience[];
  onChange: (entries: MentorshipExperience[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<MentorshipExperience>) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index
      ? { ...entry, ...patch }
      : entry));
  };
  const addExperience = () => onChange([...entries, {
    role: '',
    organization: '',
    startYear: '',
    endYear: '',
    current: false,
    description: '',
    proofLink: '',
  }]);

  return (
    <div className="boa-stack">
      {entries.length === 0 ? (
        <div className="apid-card" style={{ padding: '1rem' }}>
          <p className="boa-muted" style={{ margin: 0 }}>No mentorship experiences added yet.</p>
        </div>
      ) : entries.map((entry, index) => (
        <fieldset key={index} className="apid-card" style={{ padding: '1rem', minWidth: 0 }}>
          <legend className="boa-muted">Mentorship experience {index + 1}</legend>
          <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
            aria-label={`Remove mentorship experience ${index + 1}`}
            onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            disabled={disabled}>
            <X size={14} /> Remove
          </button>
          <div className="apid-form" style={{ marginTop: '0.75rem' }}>
            <div className="apid-field">
              <label htmlFor={`mentor-experience-${index}-role`}>Role</label>
              <input id={`mentor-experience-${index}-role`} className="apid-input"
                placeholder="Mentor, coach, trainer…" value={entry.role} maxLength={150}
                onChange={(event) => update(index, { role: event.target.value })} disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`mentor-experience-${index}-organization`}>
                Organization or program
              </label>
              <input id={`mentor-experience-${index}-organization`} className="apid-input"
                placeholder="Where did you mentor?" value={entry.organization} maxLength={200}
                onChange={(event) => update(index, { organization: event.target.value })} disabled={disabled} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="apid-field">
                <label htmlFor={`mentor-experience-${index}-start`}>Start year</label>
                <input id={`mentor-experience-${index}-start`} className="apid-input" type="number"
                  min={1950} max={new Date().getFullYear()} step={1} value={entry.startYear}
                  onChange={(event) => update(index, { startYear: event.target.value })} disabled={disabled} />
              </div>
              {!entry.current && (
                <div className="apid-field">
                  <label htmlFor={`mentor-experience-${index}-end`}>End year</label>
                  <input id={`mentor-experience-${index}-end`} className="apid-input" type="number"
                    min={entry.startYear || 1950} max={new Date().getFullYear()} step={1} value={entry.endYear}
                    onChange={(event) => update(index, { endYear: event.target.value })} disabled={disabled} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={entry.current} disabled={disabled}
                  onChange={(event) => update(index, { current: event.target.checked, endYear: '' })} />
                I currently mentor here
              </label>
            </div>
            <div className="apid-field">
              <label htmlFor={`mentor-experience-${index}-description`}>What did you mentor? (optional)</label>
              <textarea id={`mentor-experience-${index}-description`} className="apid-input" rows={3}
                value={entry.description} maxLength={1000}
                onChange={(event) => update(index, { description: event.target.value })} disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`mentor-experience-${index}-proof`}>Proof of experience (optional)</label>
              <input id={`mentor-experience-${index}-proof`} className="apid-input" type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onClick={(event) => { event.currentTarget.value = ''; }}
                onChange={(event) => update(index, { proofFile: event.target.files?.[0] })} disabled={disabled} />
              <span className="boa-muted">Upload a supporting document or provide a verification link if available (max 10 MB).</span>
            </div>
            <div className="apid-field">
              <label htmlFor={`mentor-experience-${index}-proof-link`}>Or verification link</label>
              <input id={`mentor-experience-${index}-proof-link`} className="apid-input" type="url"
                value={entry.proofLink} placeholder="https://"
                onChange={(event) => update(index, { proofLink: event.target.value })} disabled={disabled} />
            </div>
          </div>
        </fieldset>
      ))}
      <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
        onClick={addExperience} disabled={disabled}>
        Add Mentorship Experience
      </button>
    </div>
  );
}

function CareerExperienceFields({
  entries,
  onChange,
  disabled,
}: {
  entries: CareerExperience[];
  onChange: (entries: CareerExperience[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<CareerExperience>) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index
      ? { ...entry, ...patch }
      : entry));
  };

  return (
    <div className="boa-stack">
      {entries.length === 0 ? (
        <div className="apid-card" style={{ padding: '1rem' }}>
          <p className="boa-muted" style={{ margin: 0 }}>No career experience added yet.</p>
        </div>
      ) : entries.map((entry, index) => (
        <fieldset key={index} className="apid-card" style={{ padding: '1rem', minWidth: 0 }}>
          <legend className="boa-muted">Career role {index + 1}</legend>
          <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
            aria-label={`Remove career role ${index + 1}`}
            onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            disabled={disabled}>
            <X size={14} /> Remove
          </button>
          <div className="apid-form" style={{ marginTop: '0.75rem' }}>
            <div className="apid-field">
              <label htmlFor={`career-${index}-title`}>Job title</label>
              <input id={`career-${index}-title`} className="apid-input" value={entry.title}
                maxLength={150} onChange={(event) => update(index, { title: event.target.value })}
                disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`career-${index}-organization`}>Employer / organization</label>
              <input id={`career-${index}-organization`} className="apid-input" value={entry.organization}
                maxLength={200} onChange={(event) => update(index, { organization: event.target.value })}
                disabled={disabled} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="apid-field">
                <label htmlFor={`career-${index}-start`}>Start year</label>
                <input id={`career-${index}-start`} className="apid-input" type="number" min={1950}
                  max={new Date().getFullYear()} step={1} value={entry.startYear}
                  onChange={(event) => update(index, { startYear: event.target.value })}
                  disabled={disabled} />
              </div>
              {!entry.current && (
                <div className="apid-field">
                  <label htmlFor={`career-${index}-end`}>End year</label>
                  <input id={`career-${index}-end`} className="apid-input" type="number"
                    min={entry.startYear || 1950} max={new Date().getFullYear()} step={1}
                    value={entry.endYear}
                    onChange={(event) => update(index, { endYear: event.target.value })}
                    disabled={disabled} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={entry.current} disabled={disabled}
                  onChange={(event) => update(index, {
                    current: event.target.checked,
                    endYear: '',
                  })} />
                I currently work here
              </label>
            </div>
            <div className="apid-field">
              <label htmlFor={`career-${index}-description`}>Role / responsibilities (optional)</label>
              <textarea id={`career-${index}-description`} className="apid-input" rows={3}
                value={entry.description} maxLength={1000}
                onChange={(event) => update(index, { description: event.target.value })}
                disabled={disabled} />
            </div>
            <div className="apid-field">
              <label htmlFor={`career-${index}-proof`}>Proof of experience (optional)</label>
              <input id={`career-${index}-proof`} className="apid-input" type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onClick={(event) => { event.currentTarget.value = ''; }}
                onChange={(event) => update(index, { proofFile: event.target.files?.[0] })}
                disabled={disabled} />
              <small>PDF, DOC, DOCX, PNG, or JPG up to 10 MB.</small>
            </div>
            <div className="apid-field">
              <label htmlFor={`career-${index}-proof-link`}>Proof link (optional)</label>
              <input id={`career-${index}-proof-link`} className="apid-input" type="url"
                value={entry.proofLink} placeholder="https://"
                onChange={(event) => update(index, { proofLink: event.target.value })}
                disabled={disabled} />
            </div>
          </div>
        </fieldset>
      ))}
      <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
        onClick={() => onChange([...entries, {
          title: '',
          organization: '',
          startYear: '',
          endYear: '',
          current: false,
          description: '',
          proofLink: '',
        }])} disabled={disabled}>
        Add Career Experience
      </button>
    </div>
  );
}

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="apid-card" style={{ padding: '1rem' }}>
      <div className="boa-card-header">
        <h4 className="boa-card-title">{title}</h4>
        <button type="button" className="apid-btn apid-btn-outline apid-btn-sm" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="boa-stack">{children}</div>
    </section>
  );
}

export function ApplyForMentorForm({
  activeSkills,
  currentUserId,
  defaultFullName = '',
}: {
  activeSkills: SkillItem[];
  currentUserId: number;
  defaultFullName?: string;
}) {
  const { pushToast } = useToast();
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'mine', currentUserId],
    queryFn: mentorApplicationApi.listMine,
  });
  const agreementTermsQuery = useQuery({
    queryKey: ['mentoring', 'mentor-agreement-terms'],
    queryFn: mentorApplicationApi.getAgreementTerms,
  });
  const [form, setForm] = useState<ApplicationForm>(() => ({
    ...EMPTY_FORM,
    fullName: defaultFullName,
  }));
  const [step, setStep] = useState(0);
  const [mentorAgreementAccepted, setMentorAgreementAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [fieldError, setFieldError] = useState('');
  const draftKey = `mentor-application-draft-${currentUserId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<ApplicationForm>;
        const draftWithoutAvailability = Object.fromEntries(
          Object.entries(draft).filter(([key]) =>
            !['selectedDays', 'dayTimes', 'timeZone', 'formats', 'maxMentees'].includes(key)
          )
        ) as Partial<ApplicationForm>;
        setForm((current) => ({
          ...current,
          ...draftWithoutAvailability,
          educationalBackgrounds: (draft.educationalBackgrounds ?? current.educationalBackgrounds).map((entry) => ({
            educationLevel: entry.educationLevel ?? '',
            fieldOfStudy: entry.fieldOfStudy ?? '',
            institution: entry.institution ?? '',
            link: entry.link ?? '',
            file: undefined,
          })),
          professionalCertificates: (draft.professionalCertificates ?? current.professionalCertificates).map((entry) => ({
            name: entry.name ?? '',
            link: entry.link ?? '',
            skillIds: entry.skillIds ?? [],
            customSkill: entry.customSkill ?? '',
            file: undefined,
          })),
          careerExperiences: (draft.careerExperiences ?? current.careerExperiences).map((entry) => ({
            ...entry,
            proofLink: entry.proofLink ?? '',
            proofFile: undefined,
          })),
          mentorshipExperiences: (draft.mentorshipExperiences ?? current.mentorshipExperiences).map((entry) => ({
            ...entry,
            proofFile: undefined,
          })),
          fullName: defaultFullName,
          photo: undefined,
          cv: undefined,
          motivationLetter: undefined,
        }));
        pushToast({
          title: 'Draft restored',
          message: 'Your saved answers are back. Please reselect any files.',
          tone: 'info',
        });
      }
    } catch (error) {
      pushToast({
        title: 'Draft could not be restored',
        message: error instanceof Error ? error.message : 'Please start a new application.',
        tone: 'err',
      });
    }
  }, [draftKey, defaultFullName, pushToast]);

  useEffect(() => {
    setForm((current) => ({ ...current, fullName: defaultFullName }));
  }, [defaultFullName]);

  useEffect(() => {
    setMentorAgreementAccepted(false);
  }, [agreementTermsQuery.data?.version]);

  useEffect(() => {
    if (!form.photo) {
      setPhotoPreview('');
      return;
    }
    const url = URL.createObjectURL(form.photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.photo]);

  const update = (patch: Partial<ApplicationForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFieldError('');
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 0) {
      if (form.photo && form.photo.size > 10 * 1024 * 1024) {
        return 'Your profile picture must be 10 MB or smaller.';
      }
      if (form.photo && !hasFileExtension(form.photo, ['png', 'jpg', 'jpeg'])) {
        return 'Your profile picture must be a PNG or JPG image.';
      }
    }
    if (currentStep === 1) {
      if (form.educationalBackgrounds.length === 0) {
        return 'Add at least one education background.';
      }
      if (form.educationalBackgrounds.some((education) =>
        !education.educationLevel.trim()
        || !education.fieldOfStudy.trim()
        || !education.institution.trim()
        || (!education.file && !education.link.trim())
      )) {
        return 'Complete each education background and provide a certificate document or link.';
      }
      if (form.educationalBackgrounds.some((education) =>
        education.link.trim() && !isHttpUrl(education.link.trim())
      )) return 'Enter a valid HTTP or HTTPS link for each education record.';
      if (form.educationalBackgrounds.some((education) => education.file
        && !hasFileExtension(education.file, ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']))) {
        return 'Education documents must be PDF, DOC, DOCX, PNG, or JPG.';
      }
      if (form.educationalBackgrounds.some((education) =>
        education.file && education.file.size > 10 * 1024 * 1024
      )) return 'Education documents must be 10 MB or smaller.';
    }
    if (currentStep === 3) {
      if (form.professionalCertificates.some((certificate) =>
        certificate.link.trim() && !isHttpUrl(certificate.link.trim())
      )) return 'Enter a valid HTTP or HTTPS link for each certificate.';
      if (form.professionalCertificates.some((certificate) =>
        certificate.file
        && !hasFileExtension(certificate.file, ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'])
      )) {
        return 'Certificate files must be PDF, DOC, DOCX, PNG, or JPG.';
      }
      if (form.professionalCertificates.some((certificate) =>
        certificate.file && certificate.file.size > 10 * 1024 * 1024
      )) return 'Certificate documents must be 10 MB or smaller.';
    }
    if (currentStep === 4) {
      const currentYear = new Date().getFullYear();
      const isValidYear = (year: string) =>
        /^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= currentYear;
      const incompleteExperience = form.mentorshipExperiences.some((experience) =>
        (experience.startYear && !isValidYear(experience.startYear))
        || (experience.endYear && !isValidYear(experience.endYear))
        || (experience.startYear && experience.endYear
          && Number(experience.endYear) < Number(experience.startYear))
        || (experience.current && experience.endYear)
        || (experience.proofLink.trim() && !isHttpUrl(experience.proofLink.trim()))
        || (experience.proofFile
          && !hasFileExtension(experience.proofFile, ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']))
      );
      if (incompleteExperience) return 'Check the years, verification link, or proof file on your experience entry.';
      if (form.mentorshipExperiences.some((experience) =>
        experience.proofFile && experience.proofFile.size > 10 * 1024 * 1024
      )) {
        return 'Experience proof files must be 10 MB or smaller.';
      }
    }
    if (currentStep === 5) {
      const currentYear = new Date().getFullYear();
      const invalidCareerDates = form.careerExperiences.some((experience) => {
        const validYear = (year: string) =>
          /^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= currentYear;
        return (experience.startYear && !validYear(experience.startYear))
          || (experience.endYear && !validYear(experience.endYear))
          || (experience.startYear && experience.endYear
            && Number(experience.endYear) < Number(experience.startYear))
          || (experience.current && experience.endYear);
      });
      if (invalidCareerDates) return 'Check the start and end years on your career experience entries.';
      if (form.careerExperiences.some((experience) =>
        experience.proofLink.trim() && !isHttpUrl(experience.proofLink.trim())
      )) return 'Enter a valid HTTP or HTTPS link for each professional experience proof.';
      if (form.careerExperiences.some((experience) =>
        experience.proofFile
        && !hasFileExtension(experience.proofFile, ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'])
      )) return 'Professional experience proof files must be PDF, DOC, DOCX, PNG, or JPG.';
      if (form.careerExperiences.some((experience) =>
        experience.proofFile && experience.proofFile.size > 10 * 1024 * 1024
      )) return 'Professional experience proof files must be 10 MB or smaller.';
    }
    if (currentStep === 6) {
      if (form.experienceYears && !/^\d+$/.test(form.experienceYears)) {
        return 'Years of professional experience must be a non-negative whole number.';
      }
      if (form.experienceYears && Number(form.experienceYears) > 80) {
        return 'Years of professional experience cannot exceed 80.';
      }
      if (form.sessionsPerWeek && !/^\d+$/.test(form.sessionsPerWeek)) {
        return 'Sessions per week must be a non-negative whole number.';
      }
      if (form.sessionsPerWeek && Number(form.sessionsPerWeek) > 100) {
        return 'Sessions per week cannot exceed 100.';
      }
      if (form.mentoringApproach.length > 2000) return 'Mentoring approach must be 2000 characters or fewer.';
    }
    if (currentStep === 7) {
      if (form.cv && form.cv.size > 10 * 1024 * 1024) return 'Your CV must be 10 MB or smaller.';
      if (form.cv && !/\.(pdf|doc|docx)$/i.test(form.cv.name)) {
        return 'Your CV must be a PDF, DOC, or DOCX file.';
      }
      if (form.motivationLetter && form.motivationLetter.size > 10 * 1024 * 1024) {
        return 'Your letter of motivation must be 10 MB or smaller.';
      }
      if (form.motivationLetter && !/\.(pdf|doc|docx)$/i.test(form.motivationLetter.name)) {
        return 'Your letter of motivation must be a PDF, DOC, or DOCX file.';
      }
    }
    return '';
  };

  const saveDraft = () => {
    try {
      const {
        fullName: _fullName,
        photo: _photo,
        cv: _cv,
        motivationLetter: _motivationLetter,
        ...draft
      } = form;
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      pushToast({
        title: 'Draft saved',
        message: 'Your draft was saved on this device. The application was not submitted. Uploaded files must be selected again if you reopen it.',
        tone: 'ok',
      });
    } catch (error) {
      pushToast({
        title: 'Unable to save draft',
        message: error instanceof Error ? error.message : 'Please try again.',
        tone: 'err',
      });
    }
  };

  const filesForSubmission = () => {
    const files: File[] = [];
    const contexts: string[] = [];
    const addEvidence = (file: File | undefined, context: string) => {
      if (!file) return;
      files.push(file);
      contexts.push(context);
    };

    addEvidence(form.cv, 'Curriculum vitae');
    addEvidence(form.motivationLetter, 'Letter of motivation');
    addEvidence(form.photo, 'Profile picture');
    form.educationalBackgrounds.forEach((education, index) => {
      const qualification = [education.educationLevel, education.institution].filter(Boolean).join(' · ');
      addEvidence(
        education.file,
        `Education background ${index + 1}${qualification ? `: ${qualification}` : ''}`
      );
    });
    form.professionalCertificates.forEach((certificate, index) => {
      addEvidence(
        certificate.file,
        `Professional certificate ${index + 1}${certificate.name.trim() ? `: ${certificate.name.trim()}` : ''}`
      );
    });
    form.mentorshipExperiences.forEach((experience, index) => {
      const role = [experience.role.trim(), experience.organization.trim()].filter(Boolean).join(' · ');
      addEvidence(
        experience.proofFile,
        `Mentorship experience ${index + 1} proof${role ? `: ${role}` : ''}`
      );
    });
    form.careerExperiences.forEach((experience, index) => {
      const role = [experience.title.trim(), experience.organization.trim()].filter(Boolean).join(' · ');
      addEvidence(
        experience.proofFile,
        `Professional experience ${index + 1} proof${role ? `: ${role}` : ''}`
      );
    });
    return { files, contexts };
  };

  const applicationDetails = () => {
    const education = form.educationalBackgrounds.map((entry) => ({
      educationLevel: entry.educationLevel.trim(),
      fieldOfStudy: entry.fieldOfStudy.trim(),
      institution: entry.institution.trim(),
      certificateLink: entry.link.trim(),
      certificateDocument: entry.file?.name ?? '',
    }));
    const professionalCertificates = form.professionalCertificates.map((entry) => ({
      title: entry.name.trim(),
      link: entry.link.trim(),
      document: entry.file?.name ?? '',
      skills: [
        ...activeSkills
          .filter((skill) => entry.skillIds.includes(String(skill.id)))
          .map((skill) => skill.name),
        entry.customSkill.trim(),
      ].filter(Boolean),
    }));
    const selectedSkillNames = [
      ...activeSkills
        .filter((skill) => form.skillIds.includes(String(skill.id)))
        .map((skill) => skill.name),
      ...form.professionalCertificates.flatMap((certificate) => activeSkills
        .filter((skill) => certificate.skillIds.includes(String(skill.id)))
        .map((skill) => skill.name)),
      ...form.professionalCertificates.map((certificate) => certificate.customSkill.trim()),
    ];
    const careerHistory = form.careerExperiences.map((experience) => ({
      title: experience.title.trim(),
      organization: experience.organization.trim(),
      years: experience.current
        ? `${experience.startYear}–Present`
        : `${experience.startYear}${experience.endYear ? `–${experience.endYear}` : ''}`,
      description: experience.description.trim(),
      proofLink: experience.proofLink.trim(),
      proofDocument: experience.proofFile?.name ?? '',
    }));

    return [
      'MENTOR APPLICATION DETAILS',
      `Full name: ${form.fullName.trim()}`,
      `Profile picture: ${form.photo?.name ?? 'Not provided'}`,
      `Educational background: ${JSON.stringify(education)}`,
      `Mentoring interests / expertise: ${JSON.stringify([...new Set([
        ...selectedSkillNames,
        form.customSkill.trim(),
      ].filter(Boolean))])}`,
      `Professional certificates: ${JSON.stringify(professionalCertificates)}`,
      `Previous mentorship experience: ${form.hasMentorshipExperience === 'yes'
        ? JSON.stringify(form.mentorshipExperiences.map((experience) => ({
          role: experience.role.trim(),
          organization: experience.organization.trim(),
          years: experience.current
            ? `${experience.startYear}–Present`
            : `${experience.startYear}–${experience.endYear}`,
          description: experience.description.trim(),
          proofLink: experience.proofLink.trim(),
          proofDocument: experience.proofFile?.name ?? '',
        })))
        : form.hasMentorshipExperience === 'no' ? 'No' : 'Not specified'}`,
      `General professional experience: ${JSON.stringify(careerHistory)}`,
      `Years of professional experience: ${form.experienceYears}`,
      `Sessions per week: ${form.sessionsPerWeek}`,
      `Mentoring approach: ${form.mentoringApproach.trim().replace(/\r?\n/g, ' ')}`,
      `CV: ${form.cv?.name ?? ''} (${form.cv ? formatFileSize(form.cv) : ''})`,
      `Letter of motivation: ${form.motivationLetter?.name ?? ''} (${form.motivationLetter ? formatFileSize(form.motivationLetter) : ''})`,
    ].filter(Boolean).join('\n');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== STEPS.length - 1) {
      return;
    }
    if (!agreementTermsQuery.data || !mentorAgreementAccepted) {
      setFieldError('Review and accept the mentor agreement before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      const details = applicationDetails();
      const evidence = filesForSubmission();
      const selectedSkillIds = [...new Set([
        ...form.skillIds,
        ...form.professionalCertificates.flatMap((certificate) => certificate.skillIds),
      ])].map(Number);
      const customSkills = [...new Set([
        form.customSkill.trim(),
        ...form.professionalCertificates.map((certificate) => certificate.customSkill.trim()),
      ].filter(Boolean))];
      await mentorApplicationApi.submit({
        mentorAgreementAccepted: true,
        mentorAgreementVersion: agreementTermsQuery.data.version,
        supportingEvidence: evidence.files,
        supportingEvidenceContexts: evidence.contexts,
        catalogSkillIds: selectedSkillIds,
        customSkill: customSkills.join('; ') || undefined,
        note: details,
        expertiseSummary: [
          ...activeSkills
            .filter((skill) => selectedSkillIds.includes(skill.id))
            .map((skill) => skill.name),
          ...customSkills,
        ].filter(Boolean).join(', '),
        experienceYears: form.experienceYears === '' ? undefined : Number(form.experienceYears),
        sessionsPerWeek: form.sessionsPerWeek === '' ? undefined : Number(form.sessionsPerWeek),
        mentoringApproach: form.mentoringApproach.trim() || undefined,
      });
      await applicationsQuery.refetch();
      try {
        window.localStorage.removeItem(draftKey);
      } catch (error) {
        pushToast({
          title: 'Application submitted',
          message: error instanceof Error ? error.message : 'The saved local draft could not be removed.',
          tone: 'info',
        });
      }
      setSubmittedDetails(details);
      setSubmitted(true);
    } catch (error: unknown) {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to send your mentor application.';
      pushToast({ title: 'Application failed', message, tone: 'err' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applicationsQuery.isLoading) {
    return <LoadingSkeleton rows={4} height={28} />;
  }
  if (applicationsQuery.isError) {
    return (
      <ErrorState
        message="Unable to check your mentor application status."
        onRetry={() => void applicationsQuery.refetch()}
      />
    );
  }

  const initialApplications = applicationsQuery.data?.filter(
    (application) => application.applicationType === 'INITIAL'
  ) ?? [];
  const existingApplication = initialApplications.find((application) =>
    application.status !== 'DECLINED'
  );
  const declinedApplication = initialApplications.find((application) =>
    application.status === 'DECLINED'
  );
  if (submitted || existingApplication) {
    const application = existingApplication;
    const applicationDetails = application?.note ?? submittedDetails;
    const status = application?.status ?? 'PENDING';
    const statusTone = status === 'APPROVED' ? 'ok' : status === 'DECLINED' ? 'err' : 'warn';
    const submitted = applicationDetails ? parseSubmittedApplication(applicationDetails) : null;
    const fullName = submitted
      ? submittedText(submitted.values['Full name'])
      : 'Mentor applicant';
    const statusTitle = status === 'APPROVED'
      ? 'Your mentor application was approved'
      : status === 'DECLINED'
        ? 'Your mentor application needs revision'
        : 'Application submitted successfully';
    const statusDescription = status === 'APPROVED'
      ? 'Your mentor profile is now active and ready for mentoring activity.'
      : status === 'DECLINED'
        ? 'Review the feedback below and submit an updated application when ready.'
        : 'Your application is with HR for review. We will notify you when a decision is made.';

    return (
      <section className={`mentor-application-result mentor-application-result-${status.toLowerCase().replace(/_/g, '-')}`}>
        <div className="mentor-application-result-hero">
          <div className="mentor-application-result-icon" aria-hidden="true">
            {status === 'APPROVED' ? <Award size={26} /> : status === 'DECLINED' ? <X size={26} /> : <Check size={26} />}
          </div>
          <div className="mentor-application-result-copy">
            <span>Mentor application</span>
            <h3>{statusTitle}</h3>
            <p>{statusDescription}</p>
          </div>
          <StatusPill
            label={status === 'PENDING' ? 'PENDING REVIEW' : status}
            tone={statusTone}
          />
        </div>

        {application?.reviewReason && (
          <div className="mentor-application-review-note">
            <strong>HR review note</strong>
            <p>{application.reviewReason}</p>
          </div>
        )}

        <div className="mentor-application-result-actions">
          <Link to="/mentoring" className="mentor-application-action-primary">Return to mentoring</Link>
          {applicationDetails && (
            <button
              type="button"
              className="mentor-application-action-secondary"
              aria-expanded={showApplicationDetails}
              onClick={() => setShowApplicationDetails((open) => !open)}
            >
              {showApplicationDetails ? 'Hide application details' : 'View application details'}
            </button>
          )}
          {status === 'APPROVED' && (
            <Link to="/mentoring?view=trainer-profile" className="mentor-application-action-secondary">
              Open mentor profile
            </Link>
          )}
        </div>

        {showApplicationDetails && (
          <div className="mentor-application-details" aria-label="Submitted application details">
            {submitted ? (
              <>
                <div className="mentor-application-details-heading">
                  <div className="mentor-application-applicant-avatar" aria-hidden="true">
                    {fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <span>Applicant</span>
                    <h4>{fullName}</h4>
                  </div>
                </div>

                <div className="mentor-application-result-summary">
                  <div><GraduationCap size={17} /><span>Education</span><strong>{submitted.education.length}</strong></div>
                  <div><Sparkles size={17} /><span>Skills</span><strong>{submitted.skills.length}</strong></div>
                  <div><Award size={17} /><span>Certificates</span><strong>{submitted.certificates.length}</strong></div>
                </div>

                <div className="mentor-application-details-grid">
                  <article className="mentor-application-detail-card">
                    <header><Sparkles size={16} /><h4>Mentoring expertise</h4></header>
                    {submitted.skills.length ? (
                      <div className="mentor-application-result-tags">
                        {submitted.skills.map((skill) => <StatusPill key={skill} label={skill} tone="neutral" />)}
                      </div>
                    ) : <p>No mentoring interests provided.</p>}
                  </article>

                  <article className="mentor-application-detail-card">
                    <header><GraduationCap size={16} /><h4>Education</h4></header>
                    {submitted.education.length ? submitted.education.map((record, index) => (
                      <div className="mentor-application-record" key={`education-${index}`}>
                        <strong>{submittedText(record.educationLevel)}</strong>
                        <p>{submittedText(record.fieldOfStudy)}</p>
                        <span>{submittedText(record.institution)}</span>
                      </div>
                    )) : <p>No education records provided.</p>}
                  </article>

                  <article className="mentor-application-detail-card">
                    <header><Award size={16} /><h4>Professional certificates</h4></header>
                    {submitted.certificates.length ? submitted.certificates.map((record, index) => (
                      <div className="mentor-application-record" key={`certificate-${index}`}>
                        <strong>{submittedText(record.title)}</strong>
                        <p>{submittedText(record.document)}</p>
                        {Array.isArray(record.skills) && record.skills.length > 0 && (
                          <div className="mentor-application-result-tags">
                            {record.skills.map((skill) => <StatusPill key={String(skill)} label={String(skill)} tone="neutral" />)}
                          </div>
                        )}
                      </div>
                    )) : <p>No professional certificates provided.</p>}
                  </article>

                  <article className="mentor-application-detail-card">
                    <header><BriefcaseBusiness size={16} /><h4>Professional experience</h4></header>
                    {submitted.career.length ? submitted.career.map((record, index) => (
                      <div className="mentor-application-record" key={`career-${index}`}>
                        <strong>{submittedText(record.title)}</strong>
                        <p>{[record.organization, record.years].filter(Boolean).join(' · ')}</p>
                        {typeof record.description === 'string' && record.description && <span>{record.description}</span>}
                        {typeof record.proofDocument === 'string' && record.proofDocument
                          && <span>Proof: {record.proofDocument}</span>}
                        {typeof record.proofLink === 'string' && record.proofLink
                          && <a href={isHttpUrl(record.proofLink) ? record.proofLink : undefined}
                            target="_blank" rel="noreferrer">Open proof link</a>}
                      </div>
                    )) : <p>No career history provided.</p>}
                  </article>

                  <article className="mentor-application-detail-card">
                    <header><Sparkles size={16} /><h4>Mentorship preferences</h4></header>
                    <p>Years of professional experience: {submittedText(submitted.values['Years of professional experience'])}</p>
                    <p>Sessions per week: {submittedText(submitted.values['Sessions per week'])}</p>
                    <p>Mentoring approach: {submittedText(submitted.values['Mentoring approach'])}</p>
                  </article>

                  <article className="mentor-application-detail-card">
                    <header><FileText size={16} /><h4>Application documents</h4></header>
                    <div className="mentor-application-document-list">
                      <div><span>CV</span><strong>{submittedText(submitted.values.CV?.split(' (')[0])}</strong></div>
                      <div><span>Motivation letter</span><strong>{submittedText(submitted.values['Letter of motivation']?.split(' (')[0])}</strong></div>
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <p className="boa-muted">Application details are not available for this submission.</p>
            )}
          </div>
        )}
      </section>
    );
  }

  const stepContent = () => {
    if (step === 0) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">Personal Information</h3>
            <p className="boa-card-subtitle">Your account name is read-only. Add a profile picture if you want to.</p>
          </div>
          <div className="mentor-application-personal-grid">
            <div className="apid-field mentor-application-name-field">
              <label htmlFor="mentor-full-name">Full name</label>
              <input id="mentor-full-name" className="apid-input" value={form.fullName}
                aria-describedby="mentor-account-name-help" readOnly />
              <span id="mentor-account-name-help" className="boa-muted">
                This name comes from your account and cannot be changed here.
              </span>
            </div>
            <div className="apid-field mentor-application-photo-field">
              <label htmlFor="mentor-profile-photo">Profile picture <span>Optional</span></label>
              <input id="mentor-profile-photo" className="apid-input" type="file" accept="image/png,image/jpeg"
                onClick={(event) => { event.currentTarget.value = ''; }}
                onChange={(event) => update({ photo: event.target.files?.[0] })} disabled={isSubmitting} />
              <span className="boa-muted">PNG or JPG, up to 10 MB.</span>
              {photoPreview && (
                <div className="mentor-application-photo-preview">
                  <img src={photoPreview} alt="Profile picture preview"
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                  <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
                    onClick={() => update({ photo: undefined })} disabled={isSubmitting}>Remove picture</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">Educational Background</h3>
            <p className="boa-card-subtitle">
              Add each education background together with its institution and certificate document or link.
            </p>
          </div>
          <EducationBackgroundFields entries={form.educationalBackgrounds}
            onChange={(educationalBackgrounds) => update({ educationalBackgrounds })}
            disabled={isSubmitting} />
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">What would you like to mentor?</h3>
            <p className="boa-card-subtitle">
              Choose from the skill catalog or add a custom skill. Certificate skills can also be added below.
            </p>
          </div>
          <MentoringSkillChoices activeSkills={activeSkills} selectedIds={form.skillIds}
            customSkill={form.customSkill}
            onChange={(skillIds, customSkill) => update({ skillIds, customSkill })}
            disabled={isSubmitting} label="Mentoring skills / expertise" />
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">Professional Certificates</h3>
            <p className="boa-card-subtitle">
              Add a certificate title and document or link, then select the skills it demonstrates.
            </p>
          </div>
          <ProfessionalCertificateFields entries={form.professionalCertificates}
            activeSkills={activeSkills}
            onChange={(professionalCertificates) => update({ professionalCertificates })}
            disabled={isSubmitting} />
        </div>
      );
    }
    if (step === 4) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">Previous Mentorship Experience</h3>
            <p className="boa-card-subtitle">
                Tell us whether you have mentored before. If yes, you can list where, when, your role, and any proof.
            </p>
          </div>
          <fieldset className="apid-field">
            <legend>Do you have previous mentorship experience? (optional)</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="has-mentorship-experience" value="yes"
                  checked={form.hasMentorshipExperience === 'yes'} disabled={isSubmitting}
                  onChange={() => update({ hasMentorshipExperience: 'yes' })} />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="has-mentorship-experience" value="no"
                  checked={form.hasMentorshipExperience === 'no'} disabled={isSubmitting}
                  onChange={() => update({ hasMentorshipExperience: 'no', mentorshipExperiences: [] })} />
                No
              </label>
            </div>
          </fieldset>
          {form.hasMentorshipExperience === 'yes' && (
            <MentorshipExperienceFields entries={form.mentorshipExperiences}
              onChange={(mentorshipExperiences) => update({ mentorshipExperiences })}
              disabled={isSubmitting} />
          )}
          {form.hasMentorshipExperience === 'no' && (
            <p className="boa-muted">That’s okay. You can still apply based on your professional expertise.</p>
          )}
        </div>
      );
    }
    if (step === 6) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">Mentorship preferences</h3>
            <p className="boa-card-subtitle">Share your experience, weekly mentoring capacity, and approach.</p>
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-experience-years">Years of professional experience (optional)</label>
            <input id="mentor-experience-years" className="apid-input" type="number" min={0} max={80} step={1}
              value={form.experienceYears}
              onChange={(event) => update({ experienceYears: event.target.value })}
              disabled={isSubmitting} />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-sessions-per-week">Sessions per week (optional)</label>
            <input id="mentor-sessions-per-week" className="apid-input" type="number" min={0} max={100} step={1}
              value={form.sessionsPerWeek}
              onChange={(event) => update({ sessionsPerWeek: event.target.value })}
              disabled={isSubmitting} />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-approach">Mentoring approach (optional)</label>
            <textarea id="mentor-approach" className="apid-input" rows={4} maxLength={2000}
              value={form.mentoringApproach}
              onChange={(event) => update({ mentoringApproach: event.target.value })}
              disabled={isSubmitting} />
          </div>
        </div>
      );
    }
    if (step === 5) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">General Professional Experience</h3>
            <p className="boa-card-subtitle">
              List your professional career roles, organizations, dates, and responsibilities.
            </p>
          </div>
          <CareerExperienceFields entries={form.careerExperiences}
            onChange={(careerExperiences) => update({ careerExperiences })}
            disabled={isSubmitting} />
        </div>
      );
    }
    if (step === 7) {
      return (
        <div className="boa-stack">
          <div>
            <h3 className="boa-card-title">CV and Letter of Motivation</h3>
            <p className="boa-card-subtitle">
              Attach your CV and a letter explaining your interest in becoming a mentor. Both uploads are optional for now.
            </p>
          </div>
          {([
            { key: 'cv', label: 'CV', file: form.cv, accept: '.pdf,.doc,.docx' },
            { key: 'motivationLetter', label: 'Letter of motivation', file: form.motivationLetter, accept: '.pdf,.doc,.docx' },
          ] as const).map(({ key, label, file, accept }) => (
            <div className="apid-field" key={key}>
              <label htmlFor={`mentor-${key}`}>{label} (optional)</label>
              <div className="apid-card" style={{ padding: '1rem' }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedFile = event.dataTransfer.files?.[0];
                  if (key === 'cv') update({ cv: droppedFile });
                  else update({ motivationLetter: droppedFile });
                }}>
                <FileText size={24} aria-hidden="true" />
                <input id={`mentor-${key}`} className="apid-input" type="file" accept={accept}
                  onClick={(event) => { event.currentTarget.value = ''; }}
                  onChange={(event) => {
                    if (key === 'cv') update({ cv: event.target.files?.[0] });
                    else update({ motivationLetter: event.target.files?.[0] });
                  }} disabled={isSubmitting} />
                <span className="boa-muted">
                  PDF, DOC, or DOCX. Maximum 10 MB. Drag and drop is supported.
                </span>
              </div>
              {file && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <span>{file.name} · {formatFileSize(file)}</span>
                  <button type="button" className="apid-btn apid-btn-outline apid-btn-sm"
                    onClick={() => {
                      if (key === 'cv') update({ cv: undefined });
                      else update({ motivationLetter: undefined });
                    }} disabled={isSubmitting}>
                    Remove {label.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="boa-stack">
        <div>
          <h3 className="boa-card-title">Review your application</h3>
          <p className="boa-card-subtitle">Check each section before sending it for administrator review.</p>
        </div>
        <SummarySection title="Personal Information" onEdit={() => setStep(0)}>
          <p>{form.fullName}</p>
          {photoPreview && <img src={photoPreview} alt="Profile picture" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />}
        </SummarySection>
        <SummarySection title="Educational Background" onEdit={() => setStep(1)}>
          {form.educationalBackgrounds.length === 0 ? (
            <p className="boa-muted">No education background provided.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {form.educationalBackgrounds.map((education, index) => (
                <li key={`${education.institution}-${index}`}>
                  <strong>{education.educationLevel || 'Education level not provided'}</strong>
                  {education.fieldOfStudy && ` · ${education.fieldOfStudy}`}
                  {education.institution && ` · ${education.institution}`}
                  {education.file && (
                    <div className="boa-muted">
                      Document: {education.file.name}
                    </div>
                  )}
                  {education.link && <div className="boa-muted">Link: {education.link}</div>}
                  {!education.file && !education.link && <div className="boa-muted">No certificate provided</div>}
                </li>
              ))}
            </ul>
          )}
        </SummarySection>
        <SummarySection title="What I want to mentor" onEdit={() => setStep(2)}>
          <p>{[
            ...activeSkills
              .filter((skill) => form.skillIds.includes(String(skill.id)))
              .map((skill) => skill.name),
            form.customSkill,
            ...form.professionalCertificates.map((certificate) => certificate.customSkill),
          ].filter(Boolean).join(', ') || 'No mentoring interests provided.'}</p>
        </SummarySection>
        <SummarySection title="Professional Certificates" onEdit={() => setStep(3)}>
          {form.professionalCertificates.length === 0 ? (
            <p className="boa-muted">No professional certificates added.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {form.professionalCertificates.map((certificate, index) => (
                <li key={`${certificate.name}-${index}`}>
                  <strong>{certificate.name || 'Untitled certificate'}</strong>
                  {certificate.file && (
                    <div className="boa-muted">
                      File: {certificate.file.name}
                    </div>
                  )}
                  {certificate.link && <div className="boa-muted">Link: {certificate.link}</div>}
                  <div className="boa-muted">
                    Skills: {[
                      ...activeSkills
                        .filter((skill) => certificate.skillIds.includes(String(skill.id)))
                        .map((skill) => skill.name),
                      certificate.customSkill,
                    ].filter(Boolean).join(', ') || 'None selected'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SummarySection>
        <SummarySection title="Previous Mentorship Experience" onEdit={() => setStep(4)}>
          {form.hasMentorshipExperience === 'no' ? (
            <p>No previous mentorship experience reported.</p>
          ) : form.mentorshipExperiences.length === 0 ? (
            <p className="boa-muted">
              {form.hasMentorshipExperience === 'yes'
                ? 'Yes; no experience details added.'
                : 'No response provided.'}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {form.mentorshipExperiences.map((experience, index) => (
                <li key={`${experience.organization}-${index}`}>
                  <strong>{experience.role}</strong> · {experience.organization} · {experience.startYear}–{experience.current ? 'Present' : experience.endYear}
                  {experience.description && <div>{experience.description}</div>}
                  <div className="boa-muted">
                    Proof: {experience.proofFile?.name || experience.proofLink || 'Not provided'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SummarySection>
        <SummarySection title="General Professional Experience" onEdit={() => setStep(5)}>
          {form.careerExperiences.length === 0 ? (
            <p className="boa-muted">No career history added.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {form.careerExperiences.map((experience, index) => (
                <li key={`${experience.title}-${index}`}>
                  <strong>{experience.title || 'Untitled role'}</strong>
                  {experience.organization && ` · ${experience.organization}`}
                  {(experience.startYear || experience.endYear || experience.current)
                    && ` · ${experience.startYear}${experience.current
                      ? '–Present'
                      : experience.endYear ? `–${experience.endYear}` : ''}`}
                  {experience.description && <div>{experience.description}</div>}
                  {(experience.proofFile || experience.proofLink) && (
                    <div className="boa-muted">Proof: {experience.proofFile?.name ?? experience.proofLink}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SummarySection>
        <SummarySection title="Mentorship preferences" onEdit={() => setStep(6)}>
          <p>Years of professional experience: {form.experienceYears || 'Not provided'}</p>
          <p>Sessions per week: {form.sessionsPerWeek || 'Not provided'}</p>
          <p>Mentoring approach: {form.mentoringApproach.trim() || 'Not provided'}</p>
        </SummarySection>
        <SummarySection title="CV and Letter of Motivation" onEdit={() => setStep(7)}>
          <p>CV: {form.cv ? `${form.cv.name} · ${formatFileSize(form.cv)}` : 'Not provided'}</p>
          <p>Letter of motivation: {form.motivationLetter
            ? `${form.motivationLetter.name} · ${formatFileSize(form.motivationLetter)}`
            : 'Not provided'}</p>
        </SummarySection>
        <section className="mentor-agreement" aria-labelledby="mentor-agreement-title">
          <div className="mentor-agreement-heading">
            <div>
              <h4 id="mentor-agreement-title">Mentor Agreement</h4>
              <p>Review these shared responsibilities before submitting your application.</p>
            </div>
            {agreementTermsQuery.data && (
              <span>Version {agreementTermsQuery.data.version}</span>
            )}
          </div>
          {agreementTermsQuery.isLoading ? (
            <LoadingSkeleton rows={4} height={24} />
          ) : agreementTermsQuery.isError || !agreementTermsQuery.data ? (
            <ErrorState
              message={extractApiErrorMessage(
                agreementTermsQuery.error,
                'Unable to load the mentor agreement.'
              )}
              onRetry={() => void agreementTermsQuery.refetch()}
            />
          ) : (
            <>
              <ol className="mentor-agreement-conditions">
                {agreementTermsQuery.data.conditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ol>
              <label className="mentor-agreement-acceptance">
                <input
                  type="checkbox"
                  checked={mentorAgreementAccepted}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setMentorAgreementAccepted(event.target.checked);
                    setFieldError('');
                  }}
                />
                <span>
                  I have read and agree to the Mentor Agreement. I understand my acceptance will be saved with my mentor role if approved.
                </span>
              </label>
            </>
          )}
        </section>
      </div>
    );
  };

  return (
    <section className="apid-card mentor-application-wizard" aria-label="Mentor application form">
      {declinedApplication && !existingApplication && (
        <div role="status" style={{
          display: 'grid',
          gap: '0.3rem',
          marginBottom: '1.1rem',
          padding: '0.85rem 1rem',
          border: '1px solid var(--err-border)',
          borderLeft: '4px solid var(--err)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--err-soft)',
          color: 'var(--text)',
          fontSize: '0.84rem',
        }}>
          <strong>Your previous application was declined.</strong>
          <span className="boa-muted">
            You may submit a new application with updated information.
            {declinedApplication.reviewReason ? ` Review note: ${declinedApplication.reviewReason}` : ''}
          </span>
        </div>
      )}
      <div className="mentor-application-progress-panel">
        <div className="mentor-application-progress-heading">
          <div>
            <span>STEP {step + 1} OF {STEPS.length}</span>
            <strong>{STEPS[step]}</strong>
          </div>
          <span className="mentor-application-progress-caption">Application progress</span>
        </div>
        <div
          className="mentor-application-progress-track"
          role="progressbar"
          aria-label="Application progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        >
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <ol aria-label="Application steps" className="mentor-application-stepper">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`mentor-application-step${index === step ? ' is-current' : index < step ? ' is-complete' : ''}`}
              aria-current={index === step ? 'step' : undefined}
            >
              <button
                type="button"
                className="mentor-application-step-button"
              onClick={() => {
                if (index <= step) {
                  setStep(index);
                  setFieldError('');
                } else {
                  for (let validationStep = step; validationStep < index; validationStep += 1) {
                    const error = validateStep(validationStep);
                    if (error) {
                      setFieldError(error);
                      return;
                    }
                  }
                  setStep(index);
                  setFieldError('');
                }
              }}
              disabled={isSubmitting}
            >
                <span className="mentor-application-step-number">
                  {index < step ? <Check size={14} aria-hidden="true" /> : index + 1}
                </span>
                <span className="mentor-application-step-label">{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <form className="apid-form mentor-application-form" onSubmit={handleSubmit} noValidate>
        <div className={`mentor-application-step-content${step === 0 ? ' is-personal' : ''}`}>
          {stepContent()}
        </div>
        {fieldError && <p className="mentor-application-field-error" role="alert">{fieldError}</p>}
        <footer className="mentor-application-actions">
          <p className="mentor-application-draft-hint">
            <FileText size={15} aria-hidden="true" />
            Save a draft to return to this application later.
          </p>
          <div className="mentor-application-action-buttons">
            <button type="button" className="apid-btn apid-btn-outline" disabled={step === 0 || isSubmitting}
              onClick={() => { setStep((current) => Math.max(0, current - 1)); setFieldError(''); }}>
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              className="apid-btn apid-btn-outline mentor-application-save-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                saveDraft();
              }}
              disabled={isSubmitting}
            >
              <FileText size={15} aria-hidden="true" />
              Save as Draft
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="apid-btn apid-btn-primary mentor-application-next-button" disabled={isSubmitting}
                onClick={() => {
                  const error = validateStep(step);
                  if (error) setFieldError(error);
                  else { setStep((current) => current + 1); setFieldError(''); }
                }}>
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" className="apid-btn apid-btn-primary mentor-application-next-button"
                disabled={
                  isSubmitting
                  || !mentorAgreementAccepted
                  || !agreementTermsQuery.data
                  || agreementTermsQuery.isError
                }>
                {isSubmitting ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>
        </footer>
      </form>
    </section>
  );
}
