-- ====================================================================
-- COSKO MIGRATION 006: STORAGE BUCKETS & ACCESS CONTROL
-- Configures media storage for products, receipts, and branding
-- ====================================================================

-- Create Storage Buckets if missing
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('sale-attachments', 'sale-attachments', true),
  ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for Public Reading
CREATE POLICY "Public Read Access for Media Storage"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('product-images', 'sale-attachments', 'branding'));

-- Storage Policies for Authenticated Uploads
CREATE POLICY "Authenticated Users Upload Access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('product-images', 'sale-attachments', 'branding'));

-- Storage Policies for User Deletions
CREATE POLICY "Authenticated Users Delete Access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('product-images', 'sale-attachments', 'branding'));
