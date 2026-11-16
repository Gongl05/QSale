CREATE TABLE login_guards (
    account_key VARCHAR(64) PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ NOT NULL,
    locked_until TIMESTAMPTZ
);
CREATE INDEX ix_login_guards_cleanup ON login_guards(last_failure_at);

CREATE TABLE security_rate_buckets (
    bucket_key VARCHAR(64) PRIMARY KEY,
    hits INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_security_rate_cleanup ON security_rate_buckets(expires_at);
