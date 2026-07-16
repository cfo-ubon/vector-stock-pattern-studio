import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createProject } from '../../project/projectManager';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import { GlobalSearchBar } from './GlobalSearchBar';

describe('GlobalSearchBar', () => {
  it('shows no results dropdown for an empty query', () => {
    render(<GlobalSearchBar projects={[]} onSwitchProject={vi.fn()} onApplyTrendPack={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('typing a matching project name shows it as a result', () => {
    const project = createProject('Search Target Project');
    render(<GlobalSearchBar projects={[project]} onSwitchProject={vi.fn()} onApplyTrendPack={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'search target' } });
    expect(screen.getByText('Search Target Project')).toBeInTheDocument();
  });

  it('picking a project result calls onSwitchProject and clears the query', () => {
    const project = createProject('Pick Me Project');
    const onSwitchProject = vi.fn();
    render(<GlobalSearchBar projects={[project]} onSwitchProject={onSwitchProject} onApplyTrendPack={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pick me' } });
    fireEvent.click(screen.getByText('Pick Me Project'));
    expect(onSwitchProject).toHaveBeenCalledWith(project.id);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  });

  it('picking a Trend Pack result calls onApplyTrendPack with the real pack object', () => {
    const onApplyTrendPack = vi.fn();
    const pack = TREND_PACK_LIST[0];
    render(<GlobalSearchBar projects={[]} onSwitchProject={vi.fn()} onApplyTrendPack={onApplyTrendPack} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: pack.theme.slice(0, 5) } });
    fireEvent.click(screen.getByText(pack.label));
    expect(onApplyTrendPack).toHaveBeenCalledWith(pack);
  });

  it('shows a no-matches hint for a query that matches nothing', () => {
    render(<GlobalSearchBar projects={[]} onSwitchProject={vi.fn()} onApplyTrendPack={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-totally-unmatched-query' } });
    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
  });
});
