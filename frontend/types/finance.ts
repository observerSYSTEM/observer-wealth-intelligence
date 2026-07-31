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
};
