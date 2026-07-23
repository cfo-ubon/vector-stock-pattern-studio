// Build 015 — Submission Center Foundation public barrel. Mirrors the
// convention established by other large feature modules in this repo
// (e.g. `src/assets/index.ts`, `src/knowledge/index.ts`) so a future
// consumer (Build 016's UI, most likely) can import one path instead of
// reaching into individual files.

export type { SubmissionStatus } from './submissionStatus';
export {
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_TRANSITIONS,
  isSubmissionStatus,
  canTransitionSubmissionStatus,
  assertValidSubmissionTransition,
  InvalidSubmissionStatusTransitionError,
} from './submissionStatus';

export type { MarketplaceProfile } from './marketplaceProfile';
export {
  BUILT_IN_MARKETPLACE_PROFILES,
  registerMarketplaceProfile,
  getMarketplaceProfile,
  isKnownMarketplace,
  listMarketplaceProfiles,
  resetMarketplaceProfileRegistry,
  DuplicateMarketplaceProfileError,
} from './marketplaceProfile';

export type { SubmissionRecord, SubmissionStatusEvent, CreateSubmissionInput } from './submissionRecord';
export {
  SUBMISSION_SCHEMA_VERSION,
  createSubmissionRecord,
  normalizeSubmissionRecord,
  isValidSubmissionRecord,
  isValidSubmissionId,
  InvalidSubmissionInputError,
} from './submissionRecord';

export {
  loadSubmissions,
  getSubmission,
  countSubmissions,
  putSubmission,
  putSubmissionsBulk,
  deleteSubmission,
  clearSubmissionStore,
  SubmissionStorageError,
} from './submissionStore';

export type { DuplicateConflictReason, DuplicateConflict, DuplicateDetectionResult, DuplicateCandidate } from './submissionDuplicateDetection';
export { detectDuplicateSubmission } from './submissionDuplicateDetection';

export type { SubmissionValidationIssueCode, SubmissionValidationIssue, SubmissionValidationReport, SubmissionReadinessInput } from './submissionValidation';
export { validateSubmissionReadiness } from './submissionValidation';

export type { SubmissionDraftUpdate, MarkReadyResult } from './submissionService';
export {
  SubmissionNotFoundError,
  SubmissionNotEditableError,
  createSubmission,
  updateSubmissionDraft,
  transitionSubmission,
  markReady,
  enqueueSubmission,
  markSubmitted,
  markApproved,
  markRejected,
  markNeedsRevision,
  archiveSubmission,
  restoreSubmissionToDraft,
  deleteSubmissionRecord,
} from './submissionService';

export { getSubmissionQueue, getNextQueuedSubmission, getQueueLength } from './submissionQueue';

export { getSubmissionHistory, getPatternSubmissionTimeline } from './submissionHistory';

export type { SubmissionFilterCriteria } from './submissionSearchFilter';
export { filterSubmissions, searchSubmissions } from './submissionSearchFilter';

export type { MarketplaceSubmissionTotals, SubmissionStatistics } from './submissionStatistics';
export { computeSubmissionStatistics } from './submissionStatistics';

export type { SubmissionPackageOptions, SubmissionPackageManifest, SubmissionPackageResult } from './submissionPackageBuilder';
export { buildSubmissionPackage, sanitizeZipEntryName, SubmissionPackageError } from './submissionPackageBuilder';

export type { AiDeclarationStatus, EditorialDesignation } from './submissionRecord';

export type { RejectionCategory, RejectionRecord } from './rejectionIntelligence';
export { REJECTION_CATEGORIES, normalizeRejectionReason, createRejectionRecord, effectiveCategory, breakdownByCategory } from './rejectionIntelligence';

export type { SalesEvent } from './salesRevenue';
export { aggregateByMonth, aggregateByMarketplace, aggregateByProductionAsset, topPerformers, underperformingApproved } from './salesRevenue';

export type { MarketplaceRegistration, CreateMarketplaceRegistrationInput } from './marketplaceRegistration';
export {
  MARKETPLACE_REGISTRATION_SCHEMA_VERSION,
  createMarketplaceRegistration,
  normalizeMarketplaceRegistration,
  isValidMarketplaceRegistration,
  InvalidMarketplaceRegistrationInputError,
} from './marketplaceRegistration';
export {
  loadMarketplaceRegistrations,
  putMarketplaceRegistration,
  deleteMarketplaceRegistration,
  clearMarketplaceRegistrations,
  MarketplaceRegistrationStorageUnavailableError,
} from './marketplaceRegistrationStore';
