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
  confidence_score: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
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
};
