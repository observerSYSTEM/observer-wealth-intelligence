# Storage Layout

Runtime files are stored outside PostgreSQL and ignored by Git.

```text
data/
  assets/
    <user_uuid>/
      <asset_uuid>/
        <year>/
          <month>/
            <generated_filename>
  vault/
    <user_uuid>/
      <folder>/
        <year>/
          <month>/
            <generated_filename>
  receipts/
    <user_uuid>/
      <year>/
        <month>/
          <generated_filename>
  ocr/
    <user_uuid>/
      <source_type>/
        <source_id>/
          <ocr_result_id>.txt
backups/
```

PostgreSQL stores only metadata and relationships. API responses do not expose filesystem paths. The backup script copies all four runtime file roots when present, along with a PostgreSQL dump and non-secret recovery configuration.
