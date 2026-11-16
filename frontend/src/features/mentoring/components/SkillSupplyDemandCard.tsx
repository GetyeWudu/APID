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
  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Skill Demand vs Trainer Supply</h3>
          <p className="boa-card-subtitle">
            Live availability across <strong>{liveSkillNames.length} active skills</strong> in the catalog.
          </p>
        </div>
      </div>

      <SvgHorizontalBarChart
        title="Mentoring Demand vs Trainer Slots"
        description="Open trainee requests compared to available trainer capacity per skill"
        items={skillSupplyDemand.map((row) => ({
          id: row.skillName,
          label: row.skillName,
          value: row.openRequests,
          secondaryLabel: `${row.openRequests} open requests · ${row.availableTrainerSlots} trainer slots free`,
          color: row.openRequests > row.availableTrainerSlots ? '#c97a00' : '#0f766e',
        }))}
      />
    </div>
  );
}

