import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillSupplyDemandCard } from '../features/mentoring/components/SkillSupplyDemandCard';

const skills = Array.from({ length: 10 }, (_, index) => ({
  skillName: `Skill ${index}`,
  openRequests: 0,
  availableTrainerSlots: 0,
}));

describe('SkillSupplyDemandCard', () => {
  it('limits the initial chart and lets users expand or search skills', () => {
    render(<SkillSupplyDemandCard liveSkillNames={skills.map((skill) => skill.skillName)} skillSupplyDemand={skills} />);

    const chart = screen.getByRole('region', { name: 'Mentoring Demand vs Trainer Slots' });
    expect(within(chart).queryByText('Skill 9')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 skills' }));
    expect(within(chart).getByText('Skill 9')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search skills'), { target: { value: 'Skill 9' } });
    expect(within(chart).getByText('Skill 9')).toBeInTheDocument();
    expect(within(chart).queryByText('Skill 0')).not.toBeInTheDocument();
  });
});
