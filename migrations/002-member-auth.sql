CREATE TABLE lantian_members.sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX sessions_expire_idx ON lantian_members.sessions(expire);
CREATE TABLE lantian_members.rate_limits (
  bucket_key text NOT NULL,
  bucket_start bigint NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY(bucket_key,bucket_start)
);
REVOKE ALL ON lantian_members.sessions,lantian_members.rate_limits FROM PUBLIC;
