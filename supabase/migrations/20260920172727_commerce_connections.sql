-- Part B SS18: the CMS's registry of approved Medusa installations. One
-- isolated Medusa installation per commerce-enabled site (unique site_id)
-- for this first implementation — no shared-backend/multi-storefront
-- mode yet. The secret API key is stored using authenticated encryption
-- (AES-256-GCM, see apps/web/app/lib/secrets.server.ts); this table only
-- ever holds ciphertext, never plaintext. Application code is
-- responsible for masking it in every response.

create table commerce_connections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade unique,
  backend_url text not null,
  -- AES-256-GCM parts. AAD binds site_id into the ciphertext so a row
  -- can't be copied onto a different site and still decrypt.
  encrypted_secret_key bytea not null,
  secret_key_nonce bytea not null,
  secret_key_tag bytea not null,
  -- Publishable keys are storefront configuration, not secrets.
  publishable_key text,
  status text not null default 'unverified' check (status in ('unverified', 'connected', 'error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create trigger commerce_connections_set_updated_at
  before update on commerce_connections
  for each row execute function set_updated_at();

alter table commerce_connections enable row level security;

-- Credential management is sensitive — scoped to owner/administrator,
-- consistent with Part A SS11's integrations model. Editors/viewers get
-- no visibility into this table at all (not even masked metadata) until
-- an explicit capability model is built (Part B SS19); that's a
-- deliberate simplification for the first cut, not the final state.
create policy commerce_connections_select on commerce_connections
  for select using (
    workspace_role_of((select workspace_id from sites where sites.id = commerce_connections.site_id))
      in ('owner', 'administrator')
  );

create policy commerce_connections_insert on commerce_connections
  for insert
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = commerce_connections.site_id))
      in ('owner', 'administrator')
  );

create policy commerce_connections_update on commerce_connections
  for update
  using (
    workspace_role_of((select workspace_id from sites where sites.id = commerce_connections.site_id))
      in ('owner', 'administrator')
  )
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = commerce_connections.site_id))
      in ('owner', 'administrator')
  );

create policy commerce_connections_delete on commerce_connections
  for delete using (
    workspace_role_of((select workspace_id from sites where sites.id = commerce_connections.site_id))
      in ('owner', 'administrator')
  );
