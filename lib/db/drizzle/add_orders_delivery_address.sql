-- Adds per-order delivery address (required for new DELIVERY checkouts via API).
-- Apply once: psql "$DATABASE_URL" -f lib/db/drizzle/add_orders_delivery_address.sql
-- Or: pnpm run db:push (Drizzle push syncs schema without this file)

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_address" text;
