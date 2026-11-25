import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillSupplyDemandCard } from '../features/mentoring/components/SkillSupplyDemandCard';

const skills = Array.from({ length: 10 }, (_, index) => ({
  skillName: `Skill ${index}`,
  openRequests: 0,
  availableTrainerSlots: 0,
}));

describe('SkillSupplyDemandCard', () => {
  it('renders all skills in the scrollable chart and filters by search', () => {
    render(<SkillSupplyDemandCard liveSkillNames={skills.map((skill) => skill.skillName)} skillSupplyDemand={skills} />);

    const chart = screen.getByRole('region', { name: 'Mentoring Demand vs Trainer Slots' });
    expect(within(chart).getByText('Skill 9')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Scrollable skill demand and trainer supply chart' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search skills'), { target: { value: 'Skill 9' } });
    expect(within(chart).getByText('Skill 9')).toBeInTheDocument();
    expect(within(chart).queryByText('Skill 0')).not.toBeInTheDocument();
  });
});
