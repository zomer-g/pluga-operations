-- Initial relational schema — replaces the 23 Firestore collections.
--
-- Conventions:
--   * Primary keys are text so existing Firestore document ids (UUIDs, Firebase
--     uids, seed ids like 'eq-1') survive the migration unchanged.
--   * Date-only values are `date`; the operational date-times the UI edits
--     ("YYYY-MM-DDTHH:mm", no timezone) are `timestamp(0)`; audit timestamps
--     (createdAt/updatedAt/timestamp) are `timestamptz`.
--   * Every foreign key is DEFERRABLE INITIALLY DEFERRED so a batch can write
--     parents and children in any order inside one transaction.

-- ===== Permissions & auth =====

CREATE TABLE permission_groups (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false
);

CREATE TABLE group_page_permissions (
  group_id  text NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  route     text NOT NULL,
  action    text NOT NULL CHECK (action IN ('view', 'edit', 'admin')),
  PRIMARY KEY (group_id, route)
);

CREATE TABLE users (
  id             text PRIMARY KEY,
  email          text NOT NULL,
  display_name   text NOT NULL DEFAULT '',
  google_sub     text UNIQUE,
  picture        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE user_groups (
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  position  integer NOT NULL,
  group_id  text NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (user_id, position),
  UNIQUE (user_id, group_id)
);

CREATE TABLE user_page_overrides (
  user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  route    text NOT NULL,
  action   text NOT NULL CHECK (action IN ('view', 'edit', 'admin')),
  PRIMARY KEY (user_id, route)
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  ip          text,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ===== Personnel =====

CREATE TABLE platoons (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  number        integer NOT NULL,
  commander_id  text
);

CREATE TABLE squads (
  id          text PRIMARY KEY,
  platoon_id  text NOT NULL REFERENCES platoons(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  name        text NOT NULL,
  number      integer NOT NULL,
  leader_id   text
);

CREATE TABLE soldiers (
  id                   text PRIMARY KEY,
  military_id          text,
  first_name           text NOT NULL,
  last_name            text NOT NULL,
  rank                 text,
  phone_number         text,
  emergency_contact    text,
  emergency_phone      text,
  email                text,
  blood_type           text,
  medical_notes        text,
  uniform_size_top     text,
  uniform_size_bottom  text,
  shoe_size            numeric,
  helmet_size          text,
  pi_uniforms_b        text,
  pi_overalls          text,
  pi_underwear         text,
  pi_shoes             text,
  pi_cigarettes        text,
  platoon_id           text REFERENCES platoons(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  squad_id             text REFERENCES squads(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  trained_role         text CHECK (trained_role IN ('commander', 'gunner', 'driver', 'loader')),
  profile_image_url    text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX soldiers_military_id_idx ON soldiers (military_id);

ALTER TABLE platoons ADD CONSTRAINT platoons_commander_fk
  FOREIGN KEY (commander_id) REFERENCES soldiers(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE squads ADD CONSTRAINT squads_leader_fk
  FOREIGN KEY (leader_id) REFERENCES soldiers(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE status_entries (
  id            text PRIMARY KEY,
  soldier_id    text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  status        text NOT NULL CHECK (status IN ('active', 'reserve_ready', 'training', 'leave', 'medical_leave', 'preparation', 'released', 'absent', 'other')),
  start_date    date NOT NULL,
  end_date      date,
  notes         text,
  order_number  text
);
CREATE INDEX status_entries_soldier_idx ON status_entries (soldier_id);

-- ===== Equipment =====

CREATE TABLE equipment_types (
  id                      text PRIMARY KEY,
  name                    text NOT NULL,
  name_he                 text NOT NULL,
  category                text NOT NULL CHECK (category IN ('weapon', 'protective', 'communication', 'optics', 'navigation', 'clothing', 'other')),
  serial_number_required  boolean NOT NULL DEFAULT false,
  description             text
);

CREATE TABLE equipment_assignments (
  id                 text PRIMARY KEY,
  soldier_id         text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  -- NO ACTION: deleting an equipment type that still has sign-out history fails
  -- instead of silently wiping the history.
  equipment_type_id  text NOT NULL REFERENCES equipment_types(id) DEFERRABLE INITIALLY DEFERRED,
  serial_number      text,
  signed_out_date    date NOT NULL,
  signed_in_date     date,
  condition          text NOT NULL CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
  notes              text
);
CREATE INDEX equipment_assignments_soldier_idx ON equipment_assignments (soldier_id);

-- ===== Vehicles & operational assignment =====

CREATE TABLE departments (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE tanks (
  id                text PRIMARY KEY,
  designation       text NOT NULL,
  type              text NOT NULL DEFAULT '',
  vehicle_category  text CHECK (vehicle_category IN ('tank', 'standard')),
  platoon_id        text REFERENCES platoons(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  department_id     text REFERENCES departments(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  status            text NOT NULL CHECK (status IN ('operational', 'maintenance', 'damaged', 'reserve')),
  notes             text
);

CREATE TABLE tank_crew_assignments (
  id          text PRIMARY KEY,
  tank_id     text NOT NULL REFERENCES tanks(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  soldier_id  text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  role        text NOT NULL CHECK (role IN ('commander', 'gunner', 'driver', 'loader')),
  start_date  date NOT NULL,
  end_date    date
);

CREATE TABLE activations (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  notes       text
);

CREATE TABLE shampaf_entries (
  id               text PRIMARY KEY,
  soldier_id       text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  start_date_time  timestamp(0) NOT NULL,
  end_date_time    timestamp(0) NOT NULL,
  order_number     text,
  notes            text
);
CREATE INDEX shampaf_entries_soldier_idx ON shampaf_entries (soldier_id);

CREATE TABLE shampaf_vacations (
  id                text PRIMARY KEY,
  shampaf_entry_id  text NOT NULL REFERENCES shampaf_entries(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  soldier_id        text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  type              text NOT NULL DEFAULT 'vacation' CHECK (type IN ('vacation', 'preparation')),
  start_date_time   timestamp(0) NOT NULL,
  end_date_time     timestamp(0) NOT NULL,
  reason            text,
  notes             text
);
CREATE INDEX shampaf_vacations_entry_idx ON shampaf_vacations (shampaf_entry_id);

CREATE TABLE assignments (
  id               text PRIMARY KEY,
  soldier_id       text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  type             text NOT NULL CHECK (type IN ('tank_role', 'general_mission')),
  tank_id          text REFERENCES tanks(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  role             text CHECK (role IN ('commander', 'gunner', 'driver', 'loader')),
  mission_name     text,
  start_date_time  timestamp(0) NOT NULL,
  end_date_time    timestamp(0) NOT NULL,
  notes            text
);
CREATE INDEX assignments_soldier_idx ON assignments (soldier_id);
CREATE INDEX assignments_tank_idx ON assignments (tank_id);

-- ===== Routine (independent vehicles/departments) =====

CREATE TABLE routine_departments (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE routine_vehicles (
  id                text PRIMARY KEY,
  designation       text NOT NULL,
  vehicle_category  text NOT NULL DEFAULT 'tank' CHECK (vehicle_category IN ('tank', 'standard')),
  department_id     text REFERENCES routine_departments(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
);

-- The app's `RoutineTemplate.tankId` points at routine_vehicles, not tanks.
CREATE TABLE routine_templates (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  vehicle_id  text NOT NULL REFERENCES routine_vehicles(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routine_crew_slots (
  template_id  text NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  position     integer NOT NULL,
  role         text NOT NULL CHECK (role IN ('commander', 'gunner', 'driver', 'loader')),
  soldier_id   text NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (template_id, position)
);

-- Append-only history. template_id / soldier_id deliberately carry no foreign
-- key: a log row describes something that may since have been deleted.
CREATE TABLE routine_change_logs (
  id               text PRIMARY KEY,
  template_id      text NOT NULL,
  action           text NOT NULL CHECK (action IN ('assign', 'unassign', 'create', 'delete')),
  role             text,
  soldier_id       text,
  soldier_name     text,
  changed_by       text NOT NULL,
  changed_by_name  text NOT NULL,
  "timestamp"      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_change_logs_template_idx ON routine_change_logs (template_id);

-- ===== Training content =====

CREATE TABLE training_categories (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE training_tags (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  color  text
);

CREATE TABLE training_content (
  id            text PRIMARY KEY,
  title         text NOT NULL,
  description   text,
  content_type  text NOT NULL CHECK (content_type IN ('document', 'video', 'presentation', 'link', 'other')),
  content_body  text,
  file_url      text,
  external_url  text,
  category      text NOT NULL DEFAULT '',
  created_by    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Tags are stored by name (as the app does), not by training_tags id.
CREATE TABLE training_content_tags (
  content_id  text NOT NULL REFERENCES training_content(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  position    integer NOT NULL,
  tag         text NOT NULL,
  PRIMARY KEY (content_id, position)
);

-- ===== Donations =====

CREATE TABLE donations (
  id             text PRIMARY KEY,
  donor_name     text NOT NULL,
  donor_contact  text,
  donor_phone    text,
  donor_email    text,
  type           text NOT NULL CHECK (type IN ('monetary', 'equipment', 'supplies', 'other')),
  amount         numeric(14, 2),
  description    text NOT NULL DEFAULT '',
  items_list     text,
  date           date NOT NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
