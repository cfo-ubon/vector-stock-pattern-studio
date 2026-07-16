import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_LEARNING_HISTORY,
  RECENT_COLLECTIONS_LIMIT,
  loadLearningHistory,
  saveLearningHistory,
  setLearningHistoryEnabled,
  recordStyleDnaUsage,
  recordPaletteUsage,
  recordMotifUsage,
  recordCollectionGenerated,
  getFrequentStyleDna,
  getFrequentPalettes,
  getFrequentMotifs,
  getRecentCollections,
  clearLearningHistory,
  serializeLearningHistory,
  parseLearningHistoryJson,
} from './index';

beforeEach(() => {
  localStorage.clear();
});

describe('knowledge/history: load/save round-trip', () => {
  it('loadLearningHistory returns the default when nothing is stored', () => {
    expect(loadLearningHistory()).toEqual(DEFAULT_LEARNING_HISTORY);
  });

  it('saveLearningHistory + loadLearningHistory round-trips real data', () => {
    let history = recordStyleDnaUsage(DEFAULT_LEARNING_HISTORY, 'luxuryFloral');
    history = recordPaletteUsage(history, 'jewel-tones');
    saveLearningHistory(history);
    expect(loadLearningHistory()).toEqual(history);
  });

  it('recovers to defaults from corrupt stored JSON', () => {
    localStorage.setItem('vsp-knowledge-learning-history-v1', 'not json');
    expect(loadLearningHistory()).toEqual(DEFAULT_LEARNING_HISTORY);
  });

  it('defensively normalizes a partial/hand-edited object, filling missing fields with defaults', () => {
    localStorage.setItem('vsp-knowledge-learning-history-v1', JSON.stringify({ enabled: false }));
    expect(loadLearningHistory()).toEqual({ ...DEFAULT_LEARNING_HISTORY, enabled: false });
  });

  it('drops non-numeric or negative usage-count entries during normalization', () => {
    localStorage.setItem(
      'vsp-knowledge-learning-history-v1',
      JSON.stringify({ styleDnaUsage: { good: 3, bad: -1, alsoBad: 'not a number' } }),
    );
    expect(loadLearningHistory().styleDnaUsage).toEqual({ good: 3 });
  });
});

describe('knowledge/history: enable/disable', () => {
  it('setLearningHistoryEnabled toggles the flag', () => {
    const disabled = setLearningHistoryEnabled(DEFAULT_LEARNING_HISTORY, false);
    expect(disabled.enabled).toBe(false);
  });

  it('record* functions are no-ops when disabled — the real "disable" semantics', () => {
    const disabled = setLearningHistoryEnabled(DEFAULT_LEARNING_HISTORY, false);
    expect(recordStyleDnaUsage(disabled, 'luxuryFloral')).toBe(disabled);
    expect(recordPaletteUsage(disabled, 'jewel-tones')).toBe(disabled);
    expect(recordMotifUsage(disabled, 'botanical')).toBe(disabled);
    expect(recordCollectionGenerated(disabled, { id: 'a', name: 'A', createdAt: 1 })).toBe(disabled);
  });

  it('record* functions do record when enabled', () => {
    const next = recordStyleDnaUsage(DEFAULT_LEARNING_HISTORY, 'luxuryFloral');
    expect(next.styleDnaUsage.luxuryFloral).toBe(1);
  });
});

describe('knowledge/history: usage counting', () => {
  it('recording the same id twice increments its count', () => {
    let history = recordPaletteUsage(DEFAULT_LEARNING_HISTORY, 'jewel-tones');
    history = recordPaletteUsage(history, 'jewel-tones');
    expect(history.paletteUsage['jewel-tones']).toBe(2);
  });

  it('getFrequentStyleDna / getFrequentPalettes / getFrequentMotifs rank by count descending', () => {
    let history = DEFAULT_LEARNING_HISTORY;
    history = recordStyleDnaUsage(history, 'a');
    history = recordStyleDnaUsage(history, 'b');
    history = recordStyleDnaUsage(history, 'b');
    history = recordStyleDnaUsage(history, 'b');
    expect(getFrequentStyleDna(history, 2)).toEqual(['b', 'a']);

    history = recordPaletteUsage(history, 'x');
    expect(getFrequentPalettes(history)).toEqual(['x']);

    history = recordMotifUsage(history, 'botanical');
    expect(getFrequentMotifs(history)).toEqual(['botanical']);
  });

  it('respects the topN cap', () => {
    let history = DEFAULT_LEARNING_HISTORY;
    for (const id of ['a', 'b', 'c', 'd']) history = recordStyleDnaUsage(history, id);
    expect(getFrequentStyleDna(history, 2).length).toBe(2);
  });
});

describe('knowledge/history: recent collections', () => {
  it('most-recent-first, capped at RECENT_COLLECTIONS_LIMIT', () => {
    let history = DEFAULT_LEARNING_HISTORY;
    for (let i = 0; i < RECENT_COLLECTIONS_LIMIT + 5; i++) {
      history = recordCollectionGenerated(history, { id: `c${i}`, name: `Collection ${i}`, createdAt: i });
    }
    expect(history.recentCollections.length).toBe(RECENT_COLLECTIONS_LIMIT);
    expect(history.recentCollections[0].id).toBe(`c${RECENT_COLLECTIONS_LIMIT + 4}`);
  });

  it('re-recording the same collection id moves it to the front instead of duplicating', () => {
    let history = recordCollectionGenerated(DEFAULT_LEARNING_HISTORY, { id: 'a', name: 'A', createdAt: 1 });
    history = recordCollectionGenerated(history, { id: 'b', name: 'B', createdAt: 2 });
    history = recordCollectionGenerated(history, { id: 'a', name: 'A (again)', createdAt: 3 });
    expect(history.recentCollections.map((c) => c.id)).toEqual(['a', 'b']);
    expect(history.recentCollections[0].name).toBe('A (again)');
  });

  it('getRecentCollections respects topN', () => {
    let history = DEFAULT_LEARNING_HISTORY;
    history = recordCollectionGenerated(history, { id: 'a', name: 'A', createdAt: 1 });
    history = recordCollectionGenerated(history, { id: 'b', name: 'B', createdAt: 2 });
    expect(getRecentCollections(history, 1).length).toBe(1);
  });
});

describe('knowledge/history: clearLearningHistory', () => {
  it('resets usage/recents but preserves the enabled flag', () => {
    let history = setLearningHistoryEnabled(DEFAULT_LEARNING_HISTORY, false);
    history = recordStyleDnaUsage({ ...history, enabled: true }, 'a');
    const cleared = clearLearningHistory({ ...history, enabled: false });
    expect(cleared.styleDnaUsage).toEqual({});
    expect(cleared.enabled).toBe(false);
  });
});

describe('knowledge/history: export/import JSON', () => {
  it('serializeLearningHistory + parseLearningHistoryJson round-trips real data', () => {
    const history = recordStyleDnaUsage(DEFAULT_LEARNING_HISTORY, 'luxuryFloral');
    const json = serializeLearningHistory(history);
    expect(parseLearningHistoryJson(json)).toEqual(history);
  });

  it('parseLearningHistoryJson throws on malformed JSON', () => {
    expect(() => parseLearningHistoryJson('{ not json')).toThrow();
  });

  it('parseLearningHistoryJson defensively normalizes a partial import', () => {
    const result = parseLearningHistoryJson(JSON.stringify({ enabled: false }));
    expect(result).toEqual({ ...DEFAULT_LEARNING_HISTORY, enabled: false });
  });
});
