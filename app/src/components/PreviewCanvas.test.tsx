import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewCanvas } from './PreviewCanvas';
import { buildTileForGenerate } from '../engine/heroDetector';
import { defaultParams } from '../engine/defaults';

function makeTileData() {
  return buildTileForGenerate({ ...defaultParams(), seed: 'preview-canvas-test' }).tileData;
}

describe('PreviewCanvas', () => {
  it('renders no tile-border overlay by default', () => {
    const { container } = render(<PreviewCanvas tileData={makeTileData()} />);
    expect(container.querySelector('.tile-border-overlay')).toBeNull();
  });

  it('renders one dashed border rect per visible tile instance when the toggle is turned on, at the real predictable tile coordinates', () => {
    const tileData = makeTileData();
    const { container } = render(<PreviewCanvas tileData={tileData} />);

    fireEvent.click(screen.getByRole('button', { name: /แสดงเส้นขอบ Tile/ }));

    const overlay = container.querySelector('.tile-border-overlay');
    expect(overlay).not.toBeNull();
    // Default repeat is 1x1, so exactly one border rect at the tile origin.
    const rects = overlay!.querySelectorAll('rect');
    expect(rects.length).toBe(1);
    expect(rects[0].getAttribute('x')).toBe('0');
    expect(rects[0].getAttribute('y')).toBe('0');
    expect(rects[0].getAttribute('width')).toBe(String(tileData.params.tileSize));
    expect(rects[0].getAttribute('height')).toBe(String(tileData.params.tileSize));
  });

  it('draws repeat*repeat borders, one per tile instance, at the correct grid positions when repeat is increased', () => {
    const tileData = makeTileData();
    const { container } = render(<PreviewCanvas tileData={tileData} />);

    fireEvent.click(screen.getByRole('button', { name: '2×2' }));
    fireEvent.click(screen.getByRole('button', { name: /แสดงเส้นขอบ Tile/ }));

    const rects = container.querySelectorAll('.tile-border-overlay rect');
    expect(rects.length).toBe(4);
    const positions = Array.from(rects).map((r) => `${r.getAttribute('x')},${r.getAttribute('y')}`);
    const tileSize = tileData.params.tileSize;
    expect(new Set(positions)).toEqual(new Set([`0,0`, `${tileSize},0`, `0,${tileSize}`, `${tileSize},${tileSize}`]));
  });

  it('turning the toggle back off removes the overlay again', () => {
    const { container } = render(<PreviewCanvas tileData={makeTileData()} />);
    const toggle = screen.getByRole('button', { name: /แสดงเส้นขอบ Tile/ });
    fireEvent.click(toggle);
    expect(container.querySelector('.tile-border-overlay')).not.toBeNull();
    fireEvent.click(toggle);
    expect(container.querySelector('.tile-border-overlay')).toBeNull();
  });
});
