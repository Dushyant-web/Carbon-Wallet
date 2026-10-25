-- A household now has one Owner, Family (MEMBER) and View only (VIEWER); the co-manager Admin role is folded into Family.
UPDATE "memberships" SET "role" = 'MEMBER' WHERE "role" = 'ADMIN';
