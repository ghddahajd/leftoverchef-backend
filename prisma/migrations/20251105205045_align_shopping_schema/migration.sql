-- Align shopping_items table with mobile client expectations

-- Allow quantity to be nullable before type conversion
ALTER TABLE "shopping_items"
  ALTER COLUMN "quantity" DROP NOT NULL;

-- Convert quantity from text to double precision where possible, fallback to NULL
ALTER TABLE "shopping_items"
  ALTER COLUMN "quantity"
  TYPE DOUBLE PRECISION
  USING CASE
    WHEN trim("quantity") = '' THEN NULL
    WHEN trim("quantity") ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN trim("quantity")::DOUBLE PRECISION
    ELSE NULL
  END;

-- Add optional unit column
ALTER TABLE "shopping_items"
  ADD COLUMN "unit" TEXT;

-- Rename checked -> isCompleted to match API contract
ALTER TABLE "shopping_items"
  RENAME COLUMN "checked" TO "isCompleted";

-- Ensure boolean default remains in place
ALTER TABLE "shopping_items"
  ALTER COLUMN "isCompleted" SET DEFAULT false;
