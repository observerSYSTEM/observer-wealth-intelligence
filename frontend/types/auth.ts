export type UserRole = "owner" | "user";
export type Currency = "GBP" | "USD" | "NGN" | "EUR";
export type ThemePreference = "system" | "light" | "dark";

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  timezone: string;
  preferred_currency: Currency;
  created_at: string;
  updated_at: string;
};

export type SetupStatus = {
  owner_exists: boolean;
  registration_enabled: boolean;
};

export type AuthSession = {
  user: User;
  access_token_expires_at: string;
};

export type AppSettings = {
  registration_enabled: boolean;
  default_timezone: string;
  default_currency: Currency;
  savings_percentage: number;
  business_percentage: number;
  living_percentage: number;
  primary_goal_amount: string;
  primary_goal_currency: Currency;
  receipt_ocr_enabled: boolean;
  theme_preference: ThemePreference;
};
