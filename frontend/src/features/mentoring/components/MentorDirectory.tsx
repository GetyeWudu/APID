import { useMemo, useState } from 'react';
import { DataSourceBadge, EmptyState, StatusPill } from '../../../shared/components/ui';
import type { MentorDirectoryItem } from '../api/mentorDirectoryApi';

export function MentorDirectory({ mentors }: { mentors: MentorDirectoryItem[] }) {
  const [skillFilter, setSkillFilter] = useState('ALL');
  const skills = useMemo(() => {
    const byId = new Map<number, MentorDirectoryItem['skills'][number]>();
    mentors.forEach((mentor) => mentor.skills.forEach((skill) => byId.set(skill.id, skill)));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [mentors]);

  const filteredMentors = mentors.filter(
    (mentor) => skillFilter === 'ALL' || mentor.skills.some((skill) => String(skill.id) === skillFilter)
  );

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Certified Trainer Directory</h3>
          <p className="boa-card-subtitle">Browse active users assigned the Mentor role and their linked skills.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <DataSourceBadge source="live" />
        </div>
      </div>

      {filteredMentors.length === 0 ? (
        <EmptyState
          title={mentors.length === 0 ? 'No Mentors Found' : 'No Mentors for This Skill'}
          description={
            mentors.length === 0
              ? 'No active user accounts currently have the Mentor role.'
              : 'No mentors have this skill linked yet. Choose another skill or view all mentors.'
          }
        />
      ) : (
        <div className="boa-grid-2" style={{ marginBottom: 0 }}>
          {filteredMentors.map((mentor) => (
            <article
              key={mentor.userId}
              className="apid-card"
              style={{ border: '1px solid var(--border)', marginBottom: 0 }}
            >
              <div style={{ fontWeight: 700 }}>{mentor.fullName}</div>
              <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                {[mentor.employeeNumber, mentor.departmentName].filter(Boolean).join(' · ') || mentor.username}
              </div>
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
