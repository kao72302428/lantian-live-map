CREATE SCHEMA lantian_members;
REVOKE ALL ON SCHEMA lantian_members FROM PUBLIC;
CREATE TABLE lantian_members.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE lantian_members.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL UNIQUE DEFAULT ('MEM-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  member_type text NOT NULL CHECK (member_type IN ('individual','business')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  mobile text NOT NULL,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  password_hash text,
  member_status text NOT NULL DEFAULT 'pending' CHECK (member_status IN ('pending','active','suspended','disabled')),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_login_at timestamptz,
  email_verified boolean NOT NULL DEFAULT false,
  mobile_verified boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  admin_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  is_test boolean NOT NULL DEFAULT false,
  registration_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT member_id_random_format CHECK (member_id ~ '^MEM-[0-9]{8}-[A-F0-9]{32}$'),
  CONSTRAINT password_hash_format CHECK (password_hash IS NULL OR
    (is_test AND password_hash = 'TEST-ONLY-NOT-AUTHENTICATION') OR
    password_hash ~ '^[$](argon2id|argon2i|scrypt)[$]' OR
    password_hash ~ '^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$' OR
    password_hash ~ '^[a-f0-9]{32}:[a-f0-9]{128}$'),
  CONSTRAINT profile_object CHECK (jsonb_typeof(registration_profile) = 'object'),
  UNIQUE (id, member_type)
);
CREATE UNIQUE INDEX members_email_ci_unique ON lantian_members.members (lower(email));
CREATE TABLE lantian_members.business_member_profiles (
  member_fk uuid PRIMARY KEY,
  member_type text NOT NULL DEFAULT 'business' CHECK (member_type = 'business'),
  shop_id text,
  shop_name text NOT NULL CHECK (length(btrim(shop_name)) BETWEEN 1 AND 200),
  shop_identity text NOT NULL CHECK (shop_identity IN ('existing','new')),
  shop_bound boolean NOT NULL DEFAULT false,
  shop_review_status text NOT NULL DEFAULT 'pending' CHECK (shop_review_status IN ('pending','approved','returned','disabled')),
  shop_change_review_status text NOT NULL DEFAULT 'none' CHECK (shop_change_review_status IN ('none','pending','approved','returned','disabled')),
  FOREIGN KEY (member_fk,member_type) REFERENCES lantian_members.members(id,member_type),
  CHECK (shop_bound = false OR shop_id IS NOT NULL)
);
CREATE FUNCTION lantian_members.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END;
$$;
CREATE TRIGGER members_updated_at BEFORE UPDATE ON lantian_members.members
  FOR EACH ROW EXECUTE FUNCTION lantian_members.touch_updated_at();
REVOKE ALL ON ALL TABLES IN SCHEMA lantian_members FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lantian_members FROM PUBLIC;
