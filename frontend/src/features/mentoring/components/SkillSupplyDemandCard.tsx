import { useState } from 'react';
import { SvgHorizontalBarChart } from '../../../shared/components/ui';

export function SkillSupplyDemandCard({
  liveSkillNames,
  skillSupplyDemand,
}: {
  liveSkillNames: string[];
  skillSupplyDemand: Array<{
    skillName: string;
    openRequests: number;
    availableTrainerSlots: number;
  }>;
}) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const filteredSkills = skillSupplyDemand
    .filter((row) => row.skillName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort(
      (a, b) =>
        b.openRequests - a.openRequests ||
        b.availableTrainerSlots - a.availableTrainerSlots ||
        a.skillName.localeCompare(b.skillName)
    );
  const visibleSkills = showAll ? filteredSkills : filteredSkills.slice(0, 8);

  return (
    <section className="mentoring-analytics__chart">
      <div className="mentoring-dashboard__section-header">
        <div>
          <h3 className="mentoring-dashboard__section-title">Skill Demand vs Trainer Supply</h3>
          <p className="mentoring-dashboard__section-description">
            Live availability across <strong>{liveSkillNames.length} active skills</strong> in the catalog.
          </p>
        </div>
      </div>
      <div className="mentoring-skill-toolbar">
        <label className="mentoring-skill-search">
          <span className="sr-only">Search skills</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowAll(false);
            }}
            placeholder="Search skills"
          />
        </label>
        <span className="mentoring-dashboard__section-description">
          Showing {visibleSkills.length} of {filteredSkills.length}
        </span>
      </div>

      {visibleSkills.length === 0 ? (
        <p className="mentoring-dashboard__section-description" role="status">
          No skills match your search.
        </p>
      ) : (
        <div
          className="mentoring-skill-chart-scroll"
          role="region"
          aria-label="Scrollable skill demand and trainer supply chart"
          tabIndex={0}
        >
          <SvgHorizontalBarChart
            title="Mentoring Demand vs Trainer Slots"
            description="Open trainee requests compared to available trainer capacity per skill"
            items={visibleSkills.map((row) => ({
              id: row.skillName,
              label: row.skillName,
              value: row.openRequests,
              secondaryLabel: `${row.openRequests} open requests · ${row.availableTrainerSlots} trainer slots free`,
              color: row.openRequests > row.availableTrainerSlots ? '#c97a00' : '#0f766e',
            }))}
          />
        </div>
      )}
      {filteredSkills.length > 8 && (
        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          style={{ marginTop: '0.75rem' }}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? 'Show top skills' : `Show all ${filteredSkills.length} skills`}
        </button>
      )}
    </section>
  );
}

