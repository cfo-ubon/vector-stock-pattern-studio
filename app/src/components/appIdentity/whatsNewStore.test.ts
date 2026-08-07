import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowWhatsNew, markVersionSeen, setDontShowAgain, isDontShowAgainEnabled } from './whatsNewStore';

beforeEach(() => {
  localStorage.clear();
});

describe('whatsNewStore', () => {
  it('shows What\'s New for a version never marked seen', () => {
    expect(shouldShowWhatsNew('2.09')).toBe(true);
  });

  it('does not show again for a version already marked seen', () => {
    markVersionSeen('2.09');
    expect(shouldShowWhatsNew('2.09')).toBe(false);
  });

  it('shows again for a genuinely new version even if a previous version was marked seen', () => {
    markVersionSeen('2.09');
    expect(shouldShowWhatsNew('2.10')).toBe(true);
  });

  it('never shows once "don\'t show again" is set, regardless of version', () => {
    setDontShowAgain(true);
    expect(isDontShowAgainEnabled()).toBe(true);
    expect(shouldShowWhatsNew('2.09')).toBe(false);
    expect(shouldShowWhatsNew('99.0')).toBe(false);
  });

  it('"don\'t show again" defaults to false for a fresh profile', () => {
    expect(isDontShowAgainEnabled()).toBe(false);
  });
});
