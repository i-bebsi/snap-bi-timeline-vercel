-- SNAP BI Timeline — skema database (port dari Schema.gs)
-- Konvensi tipe (faithful ke model string Google Sheets):
--   string/date/datetime/enum -> text   (app membandingkan tanggal sebagai string ISO)
--   number                    -> double precision
--   boolean                   -> boolean

CREATE TABLE IF NOT EXISTS projects (
  id          text PRIMARY KEY,
  code        text,
  name        text,
  description text,
  start_date  text,
  end_date    text,
  status      text,
  created_at  text,
  updated_at  text,
  is_active   boolean
);

CREATE TABLE IF NOT EXISTS banks (
  id         text PRIMARY KEY,
  code       text,
  name       text,
  short_name text,
  active     boolean,
  sort_order double precision,
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS tasks (
  id          text PRIMARY KEY,
  project_id  text,
  bank_id     text,          -- kosong/NULL = GLOBAL task
  parent_id   text,
  task_no     text,
  task_name   text,
  description text,
  pic_id      text,
  start_date  text,
  end_date    text,
  status      text,
  progress    double precision,
  weight      double precision,
  priority    text,
  notes       text,
  created_at  text,
  created_by  text,
  updated_at  text,
  updated_by  text,
  is_active   boolean
);

CREATE TABLE IF NOT EXISTS users (
  id         text PRIMARY KEY,
  email      text,
  name       text,
  role       text,
  is_pic     boolean,
  active     boolean,
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id        text PRIMARY KEY,
  timestamp text,
  "user"    text,
  action    text,
  entity    text,
  entity_id text,
  detail    text
);

CREATE TABLE IF NOT EXISTS task_templates (
  id          text PRIMARY KEY,
  code        text,
  name        text,
  description text,
  active      boolean,
  created_at  text,
  updated_at  text
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id            text PRIMARY KEY,
  template_id   text,
  seq           double precision,
  task_name     text,
  description   text,
  duration_days double precision,
  priority      text,
  parent_seq    double precision,
  active        boolean
);

CREATE TABLE IF NOT EXISTS config (
  key         text PRIMARY KEY,
  value       text,
  type        text,
  description text,
  updated_at  text
);

CREATE TABLE IF NOT EXISTS backups (
  id           text PRIMARY KEY,
  timestamp    text,
  triggered_by text,
  environment  text,
  tables       text,
  total_rows   double precision,
  payload      text
);

CREATE TABLE IF NOT EXISTS dashboard_stats (
  id          text PRIMARY KEY,
  payload     text,
  computed_at text,
  computed_by text
);
