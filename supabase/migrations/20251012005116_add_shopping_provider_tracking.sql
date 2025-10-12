/*
  # Add Shopping Provider Integration Tracking

  ## Overview
  This migration extends the shopping_lists table to support multi-provider shopping integrations
  like Instacart and Amazon. It adds columns to track which provider each item is associated with,
  the purchase status in that provider's system, and external order/cart identifiers.

  ## Changes

  1. **Add Integration Tracking Columns**
     - `provider_name` (text, nullable) - Integration provider: 'instacart', 'amazon', 'manual', or NULL for unassigned
     - `purchase_status` (text, default 'not_sent') - Status: 'not_sent', 'in_cart', 'purchased', 'failed'
     - `external_order_id` (text, nullable) - Provider-specific order or cart ID for tracking
     - `provider_metadata` (jsonb, nullable) - Provider-specific metadata like cart URLs, timestamps, sync info
     - `provider_synced_at` (timestamptz, nullable) - Last time item was synced with provider

  2. **Add Indexes**
     - Composite index on (user_id, provider_name) for efficient provider filtering
     - Index on purchase_status for status-based queries

  3. **Data Integrity**
     - Add check constraint to ensure valid provider names
     - Add check constraint to ensure valid purchase statuses
     - Set default values for existing rows

  ## Notes
  - Existing shopping list items will have NULL provider_name and 'not_sent' status
  - Items can be in multiple provider carts by tracking status and metadata
  - The purchase_status tracks the lifecycle: not_sent → in_cart → purchased or failed
*/

-- Add provider_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'provider_name'
  ) THEN
    ALTER TABLE shopping_lists
    ADD COLUMN provider_name text
    CHECK (provider_name IN ('instacart', 'amazon', 'manual') OR provider_name IS NULL);
  END IF;
END $$;

-- Add purchase_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'purchase_status'
  ) THEN
    ALTER TABLE shopping_lists
    ADD COLUMN purchase_status text DEFAULT 'not_sent'
    CHECK (purchase_status IN ('not_sent', 'in_cart', 'purchased', 'failed'));
  END IF;
END $$;

-- Add external_order_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'external_order_id'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN external_order_id text;
  END IF;
END $$;

-- Add provider_metadata column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'provider_metadata'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN provider_metadata jsonb;
  END IF;
END $$;

-- Add provider_synced_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'provider_synced_at'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN provider_synced_at timestamptz;
  END IF;
END $$;

-- Create composite index on user_id and provider_name for efficient provider filtering
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_provider
ON shopping_lists(user_id, provider_name);

-- Create index on purchase_status for status-based queries
CREATE INDEX IF NOT EXISTS idx_shopping_lists_purchase_status
ON shopping_lists(purchase_status);

-- Create index on provider_synced_at for sync queries
CREATE INDEX IF NOT EXISTS idx_shopping_lists_provider_synced
ON shopping_lists(provider_synced_at)
WHERE provider_synced_at IS NOT NULL;
