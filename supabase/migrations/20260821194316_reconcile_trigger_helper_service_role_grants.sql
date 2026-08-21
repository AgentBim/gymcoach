-- Production retained these grants from the platform's historical default
-- privileges. Make them explicit so a fresh stack reproduces production even
-- though current Supabase projects default new functions to private.
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.set_updated_at() to service_role;
