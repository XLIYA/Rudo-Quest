ALTER TABLE tasks ADD COLUMN difficulty integer NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD CONSTRAINT tasks_difficulty CHECK (difficulty BETWEEN 1 AND 5);

CREATE TABLE task_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  amount_toman bigint NOT NULL,
  deadline timestamptz NOT NULL,
  task_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_rewards_amount CHECK (amount_toman > 0 AND amount_toman <= 1000000000000),
  CONSTRAINT task_rewards_status CHECK (status IN ('ACTIVE','APPROVED','CANCELLED')),
  CONSTRAINT task_rewards_count CHECK (cardinality(task_ids) BETWEEN 2 AND 100)
);
CREATE INDEX task_rewards_project_idx ON task_rewards(project_id, created_at);
ALTER TABLE task_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON task_rewards FROM anon, authenticated;
ALTER TABLE tasks ADD COLUMN reward_id uuid REFERENCES task_rewards(id);
CREATE INDEX tasks_reward_idx ON tasks(reward_id);
