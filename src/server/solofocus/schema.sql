CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT,
  mission TEXT NOT NULL,
  principles TEXT NOT NULL, -- JSON array of strings
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, idea
  target_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  agent_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning', -- planning, in_progress, ready, completed
  target_date TEXT,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, -- #T-xxxx
  project_id TEXT,
  milestone_id TEXT,
  domain_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'formal', -- formal, adhoc, inbox
  priority TEXT NOT NULL DEFAULT 'NORMAL', -- CRITICAL, HIGH, NORMAL, LOW
  status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, done, deferred, archived
  scheduled_date TEXT,
  due_date TEXT,
  estimated_minutes INTEGER,
  timer_seconds INTEGER DEFAULT 0,
  checklist TEXT, -- JSON array of { id, title, isCompleted }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  name TEXT NOT NULL,
  template TEXT,
  window TEXT NOT NULL DEFAULT 'morning', -- morning, intermission, evening, anytime
  mva TEXT NOT NULL,
  notes TEXT,
  streak_days INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  punch_date TEXT NOT NULL, -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  UNIQUE(habit_id, punch_date),
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sops (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'routine', -- routine, quality, ops, delivery
  summary TEXT NOT NULL,
  total_steps INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sop_steps (
  id TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL,
  step_num INTEGER NOT NULL,
  phase_title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  checklist_items TEXT NOT NULL, -- JSON array of strings
  FOREIGN KEY (sop_id) REFERENCES sops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archives (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- task, project
  entity_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  archived_at TEXT NOT NULL,
  snapshot_data TEXT -- JSON
);

CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  is_valid INTEGER NOT NULL DEFAULT 1
);
