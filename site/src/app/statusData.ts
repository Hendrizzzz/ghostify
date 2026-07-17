import rawStatusData from './statusData.json';

export type PublicVerificationStatus =
  | 'maintainer_verified'
  | 'community_verified_reviewed'
  | 'under_review'
  | 'work_in_progress'
  | 'known_issue'
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
  relatedIssueUrl: string | null;
  notes: string;
};

export type StatusData = {
  schemaVersion: 1;
  product: string;
  productVersion: string;
  generatedAt: string;
  release: {
    channel: 'Chrome Web Store';
    publishedAt: string;
    publishedVersion: string;
    verificationVersion: string;
    checkedAt: string;
    matchesVerificationBuild: boolean;
    storeUrl: string;
  };
  statusUrl: string;
  historyUrl: string;
  summary: {
    publicStatus: PublicVerificationStatus;
    label: string;
    message: string;
  };
  policy: {
    verificationCadence: string;
    latestMergedUpdateWins: boolean;
    ageDoesNotChangeStatus: boolean;
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
  entries: VerificationEntry[];
  history: Array<{
    date: string;
    publicStatus: PublicVerificationStatus;
    eventType: 'release' | 'fix' | 'verification' | 'incident' | 'investigation';
    title: string;
    summary: string;
  }>;
};

export const STATUS_DATA = rawStatusData as StatusData;

export const STATUS_LABELS: Record<PublicVerificationStatus, string> = {
  maintainer_verified: 'Maintainer verified',
  community_verified_reviewed: 'Community verified, reviewed',
  under_review: 'Under review',
  work_in_progress: 'Work in progress',
  known_issue: 'Known issue',
  public_status_unavailable: 'Public status unavailable',
};

const STATUS_WEIGHT: Record<PublicVerificationStatus, number> = {
  known_issue: 60,
  public_status_unavailable: 55,
  under_review: 50,
  work_in_progress: 50,
  community_verified_reviewed: 10,
  maintainer_verified: 0,
};

export function getEffectiveStatus(
  entry: Pick<VerificationEntry, 'publicStatus'>,
  _now = new Date(),
): PublicVerificationStatus {
  return entry.publicStatus;
}

export function getWorstStatus(entries: readonly VerificationEntry[], now = new Date()): PublicVerificationStatus {
  return entries
    .map((entry) => getEffectiveStatus(entry, now))
    .sort((left, right) => STATUS_WEIGHT[right] - STATUS_WEIGHT[left])[0] || 'public_status_unavailable';
}

export function getPublicReleaseStatus(now = new Date()): PublicVerificationStatus {
  void now;
  if (!STATUS_DATA.release.matchesVerificationBuild && (
    STATUS_DATA.summary.publicStatus === 'maintainer_verified' ||
    STATUS_DATA.summary.publicStatus === 'community_verified_reviewed'
  )) return 'under_review';
  return STATUS_DATA.summary.publicStatus;
}

export function getLastVerifiedAt(): string | null {
  return STATUS_DATA.entries
    .map((entry) => entry.verifiedAt)
    .filter((value): value is string => Boolean(value) && !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
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
