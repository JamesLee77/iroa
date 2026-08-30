BEGIN;

CREATE TABLE tasks (
  task_id char(66) PRIMARY KEY CHECK (task_id ~ '^0x[0-9a-fA-F]{64}$'),
  owner_session_id char(64) NOT NULL,
  state text NOT NULL CHECK (state IN (
    'draft', 'awaiting_approval', 'queued', 'assigned', 'running',
    'awaiting_confirmation', 'verified', 'disputed', 'failed',
    'cancelled', 'reward_pending', 'rewarded'
  )),
  policy_version text NOT NULL,
  capsule jsonb NOT NULL,
  assigned_node_id char(66),
  current_lease_nonce char(66),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_events (
  event_id uuid PRIMARY KEY,
  task_id char(66) NOT NULL REFERENCES tasks(task_id),
  previous_state text,
  next_state text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'operator', 'node', 'system')),
  actor_id_hash char(66) NOT NULL CHECK (actor_id_hash ~ '^0x[0-9a-fA-F]{64}$'),
  reason_code text NOT NULL CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE node_devices (
  node_id char(66) PRIMARY KEY CHECK (node_id ~ '^0x[0-9a-fA-F]{64}$'),
  operator_address char(42) NOT NULL CHECK (operator_address ~ '^0x[0-9a-fA-F]{40}$'),
  device_address char(42) NOT NULL UNIQUE CHECK (device_address ~ '^0x[0-9a-fA-F]{40}$'),
  device_key_hash char(66) NOT NULL UNIQUE CHECK (device_key_hash ~ '^0x[0-9a-fA-F]{64}$'),
  trust_level text NOT NULL CHECK (trust_level IN ('N0', 'N1', 'N2', 'N3')),
  policy_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  capacity_bucket text,
  agent_version text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_leases (
  lease_id uuid PRIMARY KEY,
  task_id char(66) NOT NULL REFERENCES tasks(task_id),
  nonce char(66) NOT NULL CHECK (nonce ~ '^0x[0-9a-fA-F]{64}$'),
  node_id char(66) NOT NULL REFERENCES node_devices(node_id),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (task_id, nonce)
);

CREATE UNIQUE INDEX task_leases_one_active_per_task
  ON task_leases(task_id)
  WHERE status = 'active';

CREATE TABLE receipts (
  receipt_id uuid PRIMARY KEY,
  task_id char(66) NOT NULL REFERENCES tasks(task_id),
  lease_nonce char(66) NOT NULL,
  node_id char(66) NOT NULL REFERENCES node_devices(node_id),
  kind text NOT NULL CHECK (kind IN ('result', 'deletion')),
  policy_version text NOT NULL,
  receipt_hash char(66) NOT NULL CHECK (receipt_hash ~ '^0x[0-9a-fA-F]{64}$'),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, kind),
  FOREIGN KEY (task_id, lease_nonce) REFERENCES task_leases(task_id, nonce)
);

CREATE TABLE audit_log (
  audit_id uuid PRIMARY KEY,
  action text NOT NULL CHECK (action ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'operator', 'node', 'system')),
  actor_id_hash char(66) NOT NULL CHECK (actor_id_hash ~ '^0x[0-9a-fA-F]{64}$'),
  subject_type text NOT NULL CHECK (subject_type IN ('task', 'node', 'lease', 'receipt', 'session')),
  subject_id_hash char(66) NOT NULL CHECK (subject_id_hash ~ '^0x[0-9a-fA-F]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION iroa_reject_append_only_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER task_events_append_only
  BEFORE UPDATE OR DELETE ON task_events
  FOR EACH ROW EXECUTE FUNCTION iroa_reject_append_only_mutation();

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION iroa_reject_append_only_mutation();

COMMIT;
