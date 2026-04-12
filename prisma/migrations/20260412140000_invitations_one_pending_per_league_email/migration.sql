-- Story 2.2 follow-up: at most one **pending** (unconsumed) league invite per normalized email.
-- Older duplicates are marked consumed so signup treats them like superseded invites.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY league_id, invited_email
      ORDER BY created_at DESC
    ) AS rn
  FROM invitations
  WHERE consumed_at IS NULL
    AND league_id IS NOT NULL
)
UPDATE invitations AS i
SET
  consumed_at = NOW(),
  expires_at = NOW()
FROM ranked AS r
WHERE i.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX "invitations_league_id_invited_email_pending_key"
ON "invitations" ("league_id", "invited_email")
WHERE consumed_at IS NULL AND league_id IS NOT NULL;
