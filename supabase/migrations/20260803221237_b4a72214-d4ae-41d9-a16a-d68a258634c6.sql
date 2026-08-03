CREATE POLICY "downloads_no_client_select" ON storage.objects FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "downloads_no_client_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "downloads_no_client_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "downloads_no_client_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (false);