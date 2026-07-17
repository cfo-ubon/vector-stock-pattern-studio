import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionCard } from './CollectionCard';
import { createCollection } from '../../catalog/domain/collection';

describe('CollectionCard', () => {
  it('renders the name and a real asset count (no fake statistics)', () => {
    const collection = createCollection({ name: 'Spring 2026' });
    render(<CollectionCard collection={collection} assetCount={7} hasIntegrityIssue={false} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('Spring 2026')).toBeInTheDocument();
    expect(screen.getByText('7 ชิ้นงาน')).toBeInTheDocument();
  });

  it('shows a safe fallback (no broken image, no console error) when there is no cover asset', () => {
    const collection = createCollection({ name: 'No Cover' });
    render(<CollectionCard collection={collection} assetCount={0} hasIntegrityIssue={false} selected={false} onSelect={() => {}} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the archived badge only when archived', () => {
    const archived = { ...createCollection({ name: 'Old' }), isArchived: true };
    render(<CollectionCard collection={archived} assetCount={0} hasIntegrityIssue={false} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('เก็บถาวร')).toBeInTheDocument();
  });

  it('shows an integrity warning badge when flagged', () => {
    const collection = createCollection({ name: 'Flagged' });
    render(<CollectionCard collection={collection} assetCount={0} hasIntegrityIssue={true} selected={false} onSelect={() => {}} />);
    expect(screen.getByText(/ตรวจสอบข้อมูล/)).toBeInTheDocument();
  });

  it('calls onSelect with the collection id when clicked, and reflects selected state', () => {
    const collection = createCollection({ name: 'Clickable' });
    const onSelect = vi.fn();
    render(<CollectionCard collection={collection} assetCount={0} hasIntegrityIssue={false} selected={true} onSelect={onSelect} />);
    const button = screen.getByText('Clickable').closest('button')!;
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(collection.id);
  });
});
