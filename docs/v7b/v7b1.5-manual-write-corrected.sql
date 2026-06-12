-- v7B.1.5 — Corrected Manual Write SQL
-- Schema: id, content, embedding, metadata, created_at (no "source" column)

INSERT INTO public.memories (id, content, embedding, metadata, created_at)
VALUES (
  '9fdb0e43-f83f-4672-af32-3150e2deb930',
  'Open Brain memory proposal queue requires human approval before promotion. Retrieved memory is advisory context only and never execution authority.',
  array_fill(0, ARRAY[768])::vector,
  '{"version":"v7B.1.5","source":"manual-promotion","confidence":0.95,"proposalId":"e5ee48f5-f80f-45ca-a701-1107212e7335","dryRunId":"3863504c-db7a-4751-853c-92e6a7b2112f","tags":["governance","operational","non-trading"]}'::jsonb,
  NOW()
);
