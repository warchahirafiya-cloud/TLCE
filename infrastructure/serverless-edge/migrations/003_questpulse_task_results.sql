CREATE TABLE IF NOT EXISTS tlce_questpulse_task_results (
  task_id VARCHAR(128) PRIMARY KEY,
  result_data JSONB NOT NULL CHECK (jsonb_typeof(result_data) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tlce_questpulse_task_results IS
  'First-write-wins QuestPulse task results; task_id uniqueness makes result persistence idempotent.';
