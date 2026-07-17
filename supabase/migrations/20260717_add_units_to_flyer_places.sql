alter table public.flyer_places
add column if not exists units integer;

comment on column public.flyer_places.units is 'マンション・集合住宅の戸数';
