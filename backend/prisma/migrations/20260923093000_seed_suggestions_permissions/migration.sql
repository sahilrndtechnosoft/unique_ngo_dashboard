INSERT INTO "permissions" ("module", "action", "description")
VALUES
  ('SUGGESTIONS', 'VIEW', 'View Suggestions & Ideas'),
  ('SUGGESTIONS', 'CREATE', 'Create Suggestions & Ideas'),
  ('SUGGESTIONS', 'EDIT', 'Edit Suggestions & Ideas'),
  ('SUGGESTIONS', 'DELETE', 'Delete Suggestions & Ideas')
ON CONFLICT ("module", "action") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'SUGGESTIONS'
WHERE r."slug" = 'admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'SUGGESTIONS'
WHERE r."slug" = 'moderator'
  AND p."action" IN ('VIEW', 'EDIT')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
