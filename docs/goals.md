# Goals Architecture

Financial goals are user-scoped records with name, description, category, currency, target amount, starting amount, current amount, deadline, progress source, priority, status, notes, and primary-goal state.

Only one active primary goal is allowed per user. Manual goals update `current_amount` from append-only contribution rows. Tracked-savings and linked-assets goals calculate current progress from existing wealth entries or assets without duplicating those values.

Goal contributions store amount, currency, contribution date, source type, optional source ID, notes, and creation timestamp. Linked source contributions are deduplicated by `(goal_id, source_type, source_id)`.

Completion and archival timestamps are stored independently so completed goals can remain visible while archived goals are excluded from active dashboard cards.
