export type IncomeSource = "forex" | "business" | "employment" | "other";
export type EntryStatus = "above_target" | "target_met" | "below_target" | "no_savings_required";

export type WealthEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  recorded_at: string;
  recorded_at_local: string;
  timezone: string;
  income_source: IncomeSource;
  realised_profit: string;
  currency: string;
  savings_percentage: number;
  business_percentage: number;
  living_percentage: number;
  recommended_savings: string;
  recommended_business: string;
  recommended_living: string;
  actual_savings: string;
  actual_business: string;
  actual_living: string;
  savings_variance: string;
  discipline_score: number | null;
  status: EntryStatus;
  notes: string | null;
  transfer_confirmed: boolean;
  receipt_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryList = {
  items: WealthEntry[];
  total: number;
  limit: number;
  offset: number;
  duplicate_warning: boolean;
};

export type Receipt = {
  id: string;
  user_id: string;
  original_filename: string;
  media_type: string;
  file_size: number;
  storage_backend: string;
  uploaded_at: string;
  deleted_at: string | null;
  linked_entry_id: string | null;
};

export type ReceiptList = {
  items: Receipt[];
  total: number;
  limit: number;
  offset: number;
};

export type AssetCategory =
  | "cash"
  | "investment"
  | "crypto"
  | "property"
  | "business"
  | "trading_account"
  | "vehicle"
  | "other";

export type AssetStatus = "active" | "sold" | "closed" | "archived";

export type Asset = {
  id: string;
  user_id: string;
  category: AssetCategory;
  asset_name: string;
  currency: string;
  purchase_price: string;
  current_value: string;
  exchange_rate_to_primary: string | null;
  purchase_date: string | null;
  institution: string | null;
  reference: string | null;
  notes: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
  document_count: number;
};

export type AssetList = {
  items: Asset[];
  total: number;
  limit: number;
  offset: number;
};

export type AssetHistory = {
  id: string;
  asset_id: string;
  user_id: string;
  previous_value: string | null;
  new_value: string;
  currency: string;
  valuation_date: string;
  source: string;
  notes: string | null;
  recorded_at: string;
};

export type AssetHistoryList = {
  items: AssetHistory[];
  total: number;
};

export type VaultDocument = {
  id: string;
  user_id: string;
  asset_id: string | null;
  folder: string;
  storage_area: string;
  original_filename: string;
  encrypted_filename: string;
  media_type: string;
  file_size: number;
  sha256: string;
  checksum: string;
  tags: string | null;
  notes: string | null;
  uploaded_at: string;
  deleted_at: string | null;
};

export type VaultDocumentList = {
  items: VaultDocument[];
  total: number;
  limit: number;
  offset: number;
};

export type VaultFolderSummary = {
  folder: string;
  document_count: number;
};

export type OCRResult = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  extracted_text: string | null;
  amount: string | null;
  currency: string | null;
  document_date: string | null;
  document_time: string | null;
  reference: string | null;
  recipient: string | null;
  sender: string | null;
  extracted_fields: Record<string, unknown>;
  amount_candidates: Array<Record<string, unknown>>;
  engine_name: string | null;
  engine_version: string | null;
  processing_duration_ms: number | null;
  retry_count: number;
  max_retries: number;
  failure_message: string | null;
  confidence_score: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OCRResultList = {
  items: OCRResult[];
  total: number;
  limit: number;
  offset: number;
};

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  currency: string;
  target_amount: string;
  starting_amount: string;
  current_amount: string;
  deadline: string | null;
  priority: number;
  status: string;
  progress_source: string;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  progress_percentage: string;
  remaining_amount: string;
  overfunded_amount: string;
  estimated_monthly_contribution: string | null;
};

export type GoalList = {
  items: Goal[];
  total: number;
  limit: number;
  offset: number;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: string;
  currency: string;
  contribution_date: string;
  source_type: string;
  source_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  severity: string;
  status: string;
  related_type: string | null;
  related_id: string | null;
  telegram_message_id: string | null;
  failure_reason: string | null;
  deduplication_key: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationList = {
  items: Notification[];
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
};

export type AutomationJob = {
  id: string;
  user_id: string;
  job_type: string;
  name: string;
  enabled: boolean;
  cadence: string;
  run_at_time: string;
  status: string;
  configuration: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationJobList = {
  items: AutomationJob[];
  total: number;
};

export type BackupRun = {
  id: string;
  user_id: string;
  job_id: string | null;
  trigger: string;
  status: string;
  backup_filename: string | null;
  sha256: string | null;
  size_bytes: number;
  started_at: string;
  completed_at: string | null;
  verified_at: string | null;
  restore_verified: boolean;
  verification_message: string | null;
  error_message: string | null;
};

export type BackupRunList = {
  items: BackupRun[];
  total: number;
  limit: number;
  offset: number;
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  summary: string | null;
  occurred_at: string;
  amount: string | null;
  currency: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
};

export type NotificationPreference = {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  telegram_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  daily_reminder_weekdays: string;
  weekly_summary_enabled: boolean;
  weekly_summary_day: number;
  weekly_summary_time: string;
  goal_alerts_enabled: boolean;
  ocr_alerts_enabled: boolean;
  backup_alerts_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type BackupSettings = {
  id: string;
  user_id: string;
  enabled: boolean;
  frequency: string;
  run_time: string;
  weekday: number | null;
  month_day: number | null;
  retention_daily: number;
  retention_weekly: number;
  retention_monthly: number;
  backup_path: string;
  include_secrets: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupStatus = {
  settings: BackupSettings;
  latest_backup: BackupRun | null;
  latest_success: BackupRun | null;
  latest_failure: BackupRun | null;
};

export type TimelineList = {
  items: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type CategoryValue = {
  category: string;
  currency: string;
  total_value: string;
  allocation_percentage: string;
};

export type PortfolioGrowthPoint = {
  valuation_date: string;
  currency: string;
  total_value: string;
};

export type PortfolioSummary = {
  primary_currency: string;
  total_assets: string;
  tracked_savings: string;
  cash: string;
  investments: string;
  crypto: string;
  property: string;
  business: string;
  trading_accounts: string;
  goal_progress_percentage: string;
  allocation: CategoryValue[];
  totals_by_currency: Array<{ currency: string; total_value: string }>;
  growth: PortfolioGrowthPoint[];
  recent_assets: Asset[];
  recent_receipts: Receipt[];
};

export type SearchResults = {
  assets: Asset[];
  receipts: Receipt[];
  vault_documents: VaultDocument[];
};

export type DashboardSummary = {
  tracked_savings: string;
  tracked_savings_currency: string;
  savings_this_month: string;
  savings_this_year: string;
  today_realised_profit: string;
  today_actual_savings: string;
  average_savings_per_eligible_entry: string;
  current_discipline_score: number | null;
  average_discipline_score: string | null;
  primary_goal_amount: string;
  primary_goal_currency: string;
  goal_progress_percentage: string;
  current_streak: number;
  longest_streak: number;
  latest_entries: WealthEntry[];
  savings_by_currency: Array<{ currency: string; total_actual_savings: string }>;
  daily_savings: Array<[string, string]>;
  monthly_savings: Array<[string, string]>;
  total_assets: string;
  cash: string;
  investments: string;
  crypto: string;
  property: string;
  business: string;
  trading_accounts: string;
  asset_allocation: CategoryValue[];
  portfolio_growth: Array<[string, string, string]>;
  recent_assets: Asset[];
  recent_receipts: Receipt[];
  active_goals: Goal[];
  pending_ocr_reviews: number;
  unread_notifications: number;
  recent_notifications: Notification[];
  recent_timeline: TimelineEvent[];
  latest_backup: BackupRun | null;
};
