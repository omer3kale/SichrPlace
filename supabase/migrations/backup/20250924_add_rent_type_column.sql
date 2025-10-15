-- Add rent_type column to apartments table to support German rental market standards
-- This allows landlords to specify whether rent is Kaltmiete or Warmmiete

ALTER TABLE apartments 
ADD COLUMN rent_type VARCHAR(10) 
CHECK (rent_type IN ('kalt', 'warm')) 
DEFAULT 'kalt';

-- Add comment to explain the field
COMMENT ON COLUMN apartments.rent_type IS 'German rent type: kalt (cold rent - without utilities) or warm (warm rent - including utilities)';

-- Create index for better query performance on rent_type filtering
CREATE INDEX IF NOT EXISTS idx_apartments_rent_type ON apartments(rent_type);

-- Update existing records to have a default value
UPDATE apartments 
SET rent_type = 'kalt' 
WHERE rent_type IS NULL;