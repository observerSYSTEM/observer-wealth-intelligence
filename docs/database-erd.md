# Database ERD

```mermaid
erDiagram
  users ||--o{ refresh_sessions : owns
  users ||--o{ audit_logs : writes
  users ||--o{ wealth_entries : owns
  users ||--o{ receipts : owns
  users ||--o{ assets : owns
  users ||--o{ asset_value_history : owns
  users ||--o{ vault_documents : owns
  users ||--o{ ocr_results : owns

  app_settings {
    string id PK
    boolean registration_enabled
    string default_currency
    numeric primary_goal_amount
    string primary_goal_currency
  }

  users {
    string id PK
    string email
    string role
    string timezone
    string preferred_currency
  }

  wealth_entries {
    string id PK
    string user_id FK
    date entry_date
    string income_source
    numeric realised_profit
    string currency
    numeric actual_savings
    string receipt_id FK
    string idempotency_key
  }

  receipts {
    string id PK
    string user_id FK
    string original_filename
    string stored_filename
    string sha256
    datetime uploaded_at
    datetime deleted_at
  }

  assets {
    string id PK
    string user_id FK
    string category
    string asset_name
    string currency
    numeric purchase_price
    numeric current_value
    numeric exchange_rate_to_primary
    string institution
    string reference
    string status
  }

  asset_value_history {
    string id PK
    string asset_id FK
    string user_id FK
    numeric previous_value
    numeric new_value
    string currency
    date valuation_date
    string source
    datetime recorded_at
  }

  vault_documents {
    string id PK
    string user_id FK
    string asset_id FK
    string folder
    string storage_area
    string original_filename
    string encrypted_filename
    string sha256
    string checksum
    string tags
    datetime uploaded_at
    datetime deleted_at
  }

  ocr_results {
    string id PK
    string user_id FK
    string source_type
    string source_id
    text extracted_text
    numeric amount
    string currency
    date document_date
    string document_time
    string reference
    numeric confidence_score
    string status
  }

  assets ||--o{ asset_value_history : records
  assets ||--o{ vault_documents : contains
  receipts ||--o| wealth_entries : attaches
```

`ocr_results.source_id` points to either `receipts.id` or `vault_documents.id` according to `source_type`. This is intentionally not a database foreign key because the OCR foundation supports more source types later without rewriting the table.
