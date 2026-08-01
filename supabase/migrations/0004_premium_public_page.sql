-- 1. Extendendo tenant_settings com novas informações do salão e localização
ALTER TABLE tenant_settings 
ADD COLUMN IF NOT EXISTS fantasy_name TEXT,
ADD COLUMN IF NOT EXISTS slogan TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS tiktok TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS average_response_time TEXT,
ADD COLUMN IF NOT EXISTS languages_spoken TEXT[],
ADD COLUMN IF NOT EXISTS map_link TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS full_address TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Extendendo services com fotos e promoções
ALTER TABLE services
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- 3. Extendendo professionals com experiência e idiomas
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS experience_years INTEGER,
ADD COLUMN IF NOT EXISTS languages TEXT[];

-- 4. Criação do Bucket de Storage (public_assets)
-- Insere o bucket (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso para o Storage (Permite leitura pública)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access for public_assets'
    ) THEN
        CREATE POLICY "Public Access for public_assets" 
        ON storage.objects FOR SELECT 
        USING ( bucket_id = 'public_assets' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated uploads for public_assets'
    ) THEN
        CREATE POLICY "Authenticated uploads for public_assets" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK ( bucket_id = 'public_assets' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated updates for public_assets'
    ) THEN
        CREATE POLICY "Authenticated updates for public_assets" 
        ON storage.objects FOR UPDATE 
        TO authenticated 
        USING ( bucket_id = 'public_assets' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated deletes for public_assets'
    ) THEN
        CREATE POLICY "Authenticated deletes for public_assets" 
        ON storage.objects FOR DELETE 
        TO authenticated 
        USING ( bucket_id = 'public_assets' );
    END IF;
END $$;
