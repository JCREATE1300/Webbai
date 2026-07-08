
CREATE POLICY "no client inserts on user_roles"
  ON public.user_roles FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "no client updates on user_roles"
  ON public.user_roles FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no client deletes on user_roles"
  ON public.user_roles FOR DELETE TO anon, authenticated
  USING (false);
