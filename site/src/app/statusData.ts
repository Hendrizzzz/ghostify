import rawStatusData from './statusData.json';

export type PublicVerificationStatus =
  | 'maintainer_verified'
  | 'community_verified_reviewed'
  | 'under_review'
  | 'not_recently_verified'
  | 'known_issue'
  | 'stale'
  | 'public_status_unavailable';

export type VerificationEntry = {
  id: string;
  platform: 'Instagram' | 'Messenger' | 'Facebook';
  feature: 'Hide Seen' | 'Hide Typing' | 'Hide Story Views';
  publicStatus: PublicVerificationStatus;
  localEvidenceStatus: 'manual_pending' | 'verified' | 'gap' | 'not_applicable';
  publicEvidenceType:
    | 'sender_side_no_signal'
    | 'story_owner_no_view'
    | 'local_loaded'
    | 'local_probe_blocked'
    | 'manual_smoke_pending';
  sourceType: 'maintainer' | 'reviewed_community';
  reviewer: string;
  reviewRecord: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  relatedIssueUrl: string | null;
  notes: string;
};

export type StatusData = {
  schemaVersion: 1;
  product: string;
  productVersion: string;
  generatedAt: string;
  statusUrl: string;
  historyUrl: string;
  summary: {
    publicStatus: PublicVerificationStatus;
    label: string;
    message: string;
  };
  policy: {
    verificationCadence: string;
    verifiedStatusExpiresAfterDays: number;
    staleBehavior: string;
  };
  automationPolicy: {
    canFlagReports: boolean;
    canSummarizeReports: boolean;
    canDowngradeStatus: boolean;
    canMarkVerified: boolean;
  };
  communityVerification: {
    requiresMaintainerReview: boolean;
    publicCreditRequiresOptIn: boolean;
    screenshotsMustBeRedacted: boolean;
    privateMessagesAllowed: boolean;
    rawSubmissionsShownInPopup: boolean;
  };
  provenWorking: {
    previousWindowStartedAt: string;
    previousWindowEndedAt: string;
    interruptionReportedAt: string;
    interruptionVerifiedAt: string;
    fixReleasedAt: string;
    currentWindowStartedAt: string;
    lastVerifiedAt: string;
    summary: string;
  };
  entries: VerificationEntry[];
  history: Array<{
    date: string;
    publicStatus: PublicVerificationStatus;
    title: string;
    summary: string;
  }>;
};

export const STATUS_DATA = rawStatusData as StatusData;

export const STATUS_LABELS: Record<PublicVerificationStatus, string> = {
  maintainer_verified: 'Maintainer verified',
  community_verified_reviewed: 'Community verified, reviewed',
  under_review: 'Under review',
  not_recently_verified: 'Not recently verified',
  known_issue: 'Known issue',
  stale: 'Stale',
  public_status_unavailable: 'Public status unavailable',
};

const STATUS_WEIGHT: Record<PublicVerificationStatus, number> = {
  known_issue: 60,
  public_status_unavailable: 55,
  under_review: 50,
  stale: 40,
  not_recently_verified: 30,
  community_verified_reviewed: 10,
  maintainer_verified: 0,
};

const VERIFIED_STATUSES = new Set<PublicVerificationStatus>([
  'maintainer_verified',
  'community_verified_reviewed',
]);

export function getEffectiveStatus(
  entry: Pick<VerificationEntry, 'publicStatus' | 'expiresAt'>,
  now = new Date(),
): PublicVerificationStatus {
  if (!VERIFIED_STATUSES.has(entry.publicStatus)) {
    return entry.publicStatus;
  }

  if (!entry.expiresAt) {
    return 'stale';
  }

  const expiry = new Date(entry.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return 'stale';
  }

  return entry.publicStatus;
}

export function getWorstStatus(entries: readonly VerificationEntry[], now = new Date()): PublicVerificationStatus {
  return entries
    .map((entry) => getEffectiveStatus(entry, now))
    .sort((left, right) => STATUS_WEIGHT[right] - STATUS_WEIGHT[left])[0] || 'public_status_unavailable';
}

export function formatStatusDate(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
