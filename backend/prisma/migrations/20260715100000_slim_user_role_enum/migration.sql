-- Slim user_role to portal account types: USER, SELLER, ADMIN, SUPER_ADMIN
-- Map deprecated values before rewriting the enum type.

-- Assign moderator RBAC role to former MODERATOR staff before demoting account type
UPDATE users AS u
SET rbac_role_id = r.id
FROM roles AS r
WHERE u.role::text = 'MODERATOR'
  AND r.slug = 'moderator'
  AND u.rbac_role_id IS NULL
  AND u.deleted_at IS NULL;

UPDATE users SET role = 'USER' WHERE role::text = 'PREMIUM_USER';
UPDATE users SET role = 'SELLER' WHERE role::text = 'PREMIUM_SELLER';
UPDATE users SET role = 'ADMIN' WHERE role::text = 'MODERATOR';

UPDATE membership_plans SET role = 'USER' WHERE role::text = 'PREMIUM_USER';
UPDATE membership_plans SET role = 'SELLER' WHERE role::text = 'PREMIUM_SELLER';
UPDATE membership_plans SET role = 'ADMIN' WHERE role::text = 'MODERATOR';

CREATE TYPE "user_role_new" AS ENUM ('USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role_new"
  USING ("role"::text::"user_role_new");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER'::"user_role_new";

ALTER TABLE "membership_plans" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "membership_plans"
  ALTER COLUMN "role" TYPE "user_role_new"
  USING ("role"::text::"user_role_new");
ALTER TABLE "membership_plans" ALTER COLUMN "role" SET DEFAULT 'USER'::"user_role_new";

DROP TYPE "user_role";
ALTER TYPE "user_role_new" RENAME TO "user_role";
