import type { SeoProfile } from './seoProfile';

// Build 016 — Marketplace Rules: the rule-*evaluation* half of
// `seoProfile.ts`'s rule-*data*. Every other module that needs to know
// "is this title/description/keyword list within marketplace X's
// bounds" goes through these three functions — `seoValidator.ts` turns a
// non-compliant result into errors, the analyzers use it for their own
// `complianceScore` dimension, `seoGenerator.ts` uses it to decide what
// still needs trimming after generation. One rule implementation, reused
// everywhere, rather than each caller re-deriving bounds checks itself.

export interface ComplianceCheck {
  compliant: boolean;
  reasons: string[];
}

export function checkTitleCompliance(title: string, profile: SeoProfile): ComplianceCheck {
  const reasons: string[] = [];
  const length = title.trim().length;
  if (length === 0) reasons.push('Title is empty.');
  else if (length < profile.title.minLength) reasons.push(`Title is ${length} characters, below ${profile.label}'s minimum of ${profile.title.minLength}.`);
  if (length > profile.title.maxLength) reasons.push(`Title is ${length} characters, over ${profile.label}'s maximum of ${profile.title.maxLength}.`);
  return { compliant: reasons.length === 0, reasons };
}

export function checkDescriptionCompliance(description: string, profile: SeoProfile): ComplianceCheck {
  const reasons: string[] = [];
  const length = description.trim().length;
  if (profile.description.required && length === 0) {
    reasons.push(`${profile.label} requires a description.`);
  } else if (length > 0 && length < profile.description.minLength) {
    reasons.push(`Description is ${length} characters, below ${profile.label}'s minimum of ${profile.description.minLength}.`);
  }
  if (length > profile.description.maxLength) reasons.push(`Description is ${length} characters, over ${profile.label}'s maximum of ${profile.description.maxLength}.`);
  return { compliant: reasons.length === 0, reasons };
}

export function checkKeywordCompliance(keywords: string[], profile: SeoProfile): ComplianceCheck {
  const reasons: string[] = [];
  if (keywords.length < profile.keywords.minCount) reasons.push(`${keywords.length} keyword(s) provided, below ${profile.label}'s minimum of ${profile.keywords.minCount}.`);
  if (keywords.length > profile.keywords.maxCount) reasons.push(`${keywords.length} keyword(s) provided, over ${profile.label}'s maximum of ${profile.keywords.maxCount}.`);
  const overLong = keywords.filter((k) => k.length > profile.keywords.maxKeywordLength);
  if (overLong.length > 0) reasons.push(`${overLong.length} keyword(s) exceed ${profile.label}'s per-keyword limit of ${profile.keywords.maxKeywordLength} characters.`);
  return { compliant: reasons.length === 0, reasons };
}
