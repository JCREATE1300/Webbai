DROP POLICY IF EXISTS "downloads_no_client_update" ON storage.objects;
DROP POLICY IF EXISTS "downloads_no_client_insert" ON storage.objects;
DROP POLICY IF EXISTS "downloads_no_client_delete" ON storage.objects;
DROP POLICY IF EXISTS "downloads_no_client_select" ON storage.objects;

CREATE POLICY "no guest sessions on threads" ON public.threads AS RESTRICTIVE FOR ALL TO authenticated
  USING (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
  WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE);
CREATE POLICY "no guest sessions on messages" ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
  WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE);