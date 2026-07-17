import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateCollectionDialog } from './CreateCollectionDialog';
import { createCollection } from '../../catalog/domain/collection';

describe('CreateCollectionDialog', () => {
  it('rejects an empty name without calling onCreate', () => {
    const onCreate = vi.fn();
    render(<CreateCollectionDialog onCreate={onCreate} onCreated={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText('สร้างคอลเลกชัน'));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุชื่อคอลเลกชัน');
  });

  it('submits trimmed name and description, then calls onCreated with the result', async () => {
    const created = createCollection({ name: 'Spring 2026' });
    const onCreate = vi.fn().mockResolvedValue(created);
    const onCreated = vi.fn();
    render(<CreateCollectionDialog onCreate={onCreate} onCreated={onCreated} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('ชื่อคอลเลกชัน'), { target: { value: '  Spring 2026  ' } });
    fireEvent.click(screen.getByText('สร้างคอลเลกชัน'));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('  Spring 2026  ', ''));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
  });

  it('shows a duplicate-name error and preserves the entered text on recoverable failure', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('A collection named "Spring 2026" already exists (case-insensitive match).'));
    render(<CreateCollectionDialog onCreate={onCreate} onCreated={() => {}} onClose={() => {}} />);

    const nameInput = screen.getByLabelText('ชื่อคอลเลกชัน') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Spring 2026' } });
    fireEvent.click(screen.getByText('สร้างคอลเลกชัน'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already exists/));
    // The entered text must still be there — never lost on a recoverable failure.
    expect(nameInput.value).toBe('Spring 2026');
  });

  it('disables the submit button while saving to prevent double submission', async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    const onCreate = vi.fn(() => new Promise((resolve) => (resolveCreate = resolve)));
    render(<CreateCollectionDialog onCreate={onCreate as never} onCreated={() => {}} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('ชื่อคอลเลกชัน'), { target: { value: 'A' } });
    fireEvent.click(screen.getByText('สร้างคอลเลกชัน'));
    fireEvent.click(screen.getByText('กำลังสร้าง…'));

    expect(onCreate).toHaveBeenCalledTimes(1);
    resolveCreate(createCollection({ name: 'A' }));
  });

  it('Escape on the backdrop calls onClose', () => {
    const onClose = vi.fn();
    render(<CreateCollectionDialog onCreate={vi.fn()} onCreated={() => {}} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
