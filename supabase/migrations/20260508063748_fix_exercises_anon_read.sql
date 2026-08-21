
drop policy "Anyone authenticated can view exercises" on public.exercises;

create policy "Anyone can view exercises"
  on public.exercises for select
  using (true);
