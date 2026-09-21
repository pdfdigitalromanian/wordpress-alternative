-- Work order (checkout milestone) SS3C: replace "take the first Medusa
-- region" with an explicit per-site default region. Nullable — when
-- unset, resolveStorefront() falls back to the backend's first region,
-- which is correct for (and the only case tested against) a
-- single-region store; this column is what lets an operator pick
-- deliberately once a store has more than one.
alter table commerce_connections
  add column default_region_id text;
