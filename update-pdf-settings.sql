-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Check for header_height
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pdf_settings' AND column_name = 'header_height'
    ) THEN
        ALTER TABLE pdf_settings ADD COLUMN header_height INTEGER NOT NULL DEFAULT 100;
        RAISE NOTICE 'Added header_height column to pdf_settings table';
    ELSE
        RAISE NOTICE 'header_height column already exists in pdf_settings table';
    END IF;

    -- Check for footer_height
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pdf_settings' AND column_name = 'footer_height'
    ) THEN
        ALTER TABLE pdf_settings ADD COLUMN footer_height INTEGER NOT NULL DEFAULT 50;
        RAISE NOTICE 'Added footer_height column to pdf_settings table';
    ELSE
        RAISE NOTICE 'footer_height column already exists in pdf_settings table';
    END IF;
END $$;

-- Show the updated schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'pdf_settings'
ORDER BY ordinal_position;