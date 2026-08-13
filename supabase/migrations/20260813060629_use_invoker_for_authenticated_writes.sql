-- Authenticated transactional RPCs rely on the caller's grants and RLS.
alter function public.save_program(uuid, text, text, integer, jsonb) security invoker;
alter function public.duplicate_workout(uuid) security invoker;
alter function public.rotate_assignment_link(uuid) security invoker;
