-- Dữ liệu co-op tách hoàn toàn save Legacy. Chỉ backend service_role được ghi gameplay.
begin;
create table public.awakening_characters (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.awakening_worlds (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.awakening_events (
  id uuid primary key,
  world_owner uuid not null references auth.users(id) on delete cascade,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);
create table public.awakening_sessions (
  id uuid primary key,
  host uuid not null references auth.users(id) on delete cascade,
  code text not null,
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.awakening_session_members (
  session_id uuid not null references public.awakening_sessions(id) on delete cascade,
  member uuid not null references auth.users(id) on delete cascade,
  primary key(session_id,member)
);
alter table public.awakening_characters enable row level security;
alter table public.awakening_worlds enable row level security;
alter table public.awakening_events enable row level security;
alter table public.awakening_sessions enable row level security;
alter table public.awakening_session_members enable row level security;
create policy own_character on public.awakening_characters for select to authenticated using(owner=(select auth.uid()));
create policy own_world on public.awakening_worlds for select to authenticated using(owner=(select auth.uid()));
revoke all on public.awakening_characters, public.awakening_worlds, public.awakening_events, public.awakening_sessions, public.awakening_session_members from anon, authenticated;
grant select on public.awakening_characters, public.awakening_worlds to authenticated;
grant all on public.awakening_characters, public.awakening_worlds, public.awakening_events, public.awakening_sessions, public.awakening_session_members to service_role;

create function public.awakening_load(p_user uuid) returns jsonb language plpgsql set search_path='' as $$
declare c jsonb; w jsonb;
begin
  insert into public.awakening_characters(owner,data) values(p_user,jsonb_build_object('id',p_user,'revision',0,'weapon','sword','coins',0,'materials',0,'victories','[]'::jsonb)) on conflict do nothing;
  insert into public.awakening_worlds(owner,data) values(p_user,jsonb_build_object('id',p_user,'revision',0,'cleared','[]'::jsonb,'abilities','[]'::jsonb,'buildings','[]'::jsonb,'secrets','[]'::jsonb,'stock',0)) on conflict do nothing;
  select data into c from public.awakening_characters where owner=p_user;
  select data into w from public.awakening_worlds where owner=p_user;
  return jsonb_build_object('character',c,'world',w);
end $$;

-- Khóa event trước để retry song song có cùng receipt; khóa nhân vật theo UUID để tránh deadlock.
create function public.awakening_commit(p_event uuid,p_world jsonb,p_characters jsonb) returns jsonb language plpgsql set search_path='' as $$
declare receipt jsonb; c jsonb; saved jsonb; cs jsonb='[]'; w jsonb; rev integer; owner_id uuid=(p_world->>'id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event::text,0));
  select e.receipt into receipt from public.awakening_events e where id=p_event;
  if found then return receipt; end if;
  if jsonb_typeof(p_characters)<>'array' or jsonb_array_length(p_characters) not between 1 and 4 then raise exception 'invalid characters'; end if;
  if not exists(select 1 from jsonb_array_elements(p_characters) a where (a->>'id')::uuid=owner_id) then raise exception 'missing host'; end if;
  if (select count(distinct a->>'id') from jsonb_array_elements(p_characters) a)<>jsonb_array_length(p_characters) then raise exception 'duplicate character'; end if;
  select revision into rev from public.awakening_worlds where owner=owner_id for update;
  if not found or rev<>(p_world->>'revision')::integer then raise exception 'world revision conflict'; end if;
  w=jsonb_set(p_world,'{revision}',to_jsonb(rev+1));
  for c in select value from jsonb_array_elements(p_characters) order by value->>'id' loop
    select revision into rev from public.awakening_characters where owner=(c->>'id')::uuid for update;
    if not found or rev<>(c->>'revision')::integer then raise exception 'character revision conflict'; end if;
    saved=jsonb_set(c,'{revision}',to_jsonb(rev+1));
    update public.awakening_characters set data=saved,revision=rev+1,updated_at=now() where owner=(c->>'id')::uuid;
    cs=cs||jsonb_build_array(saved);
  end loop;
  update public.awakening_worlds set data=w,revision=revision+1,updated_at=now() where owner=owner_id;
  receipt=jsonb_build_object('world',w,'characters',cs);
  insert into public.awakening_events(id,world_owner,receipt) values(p_event,owner_id,receipt);
  return receipt;
end $$;
create function public.awakening_session(p_id uuid,p_host uuid,p_code text,p_members jsonb,p_closed boolean) returns void language plpgsql set search_path='' as $$
begin
  insert into public.awakening_sessions(id,host,code,closed) values(p_id,p_host,p_code,p_closed)
    on conflict(id) do update set closed=excluded.closed,updated_at=now();
  insert into public.awakening_session_members(session_id,member) select p_id,value::uuid from jsonb_array_elements_text(p_members) on conflict do nothing;
end $$;
revoke all on function public.awakening_load(uuid), public.awakening_commit(uuid,jsonb,jsonb), public.awakening_session(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.awakening_load(uuid), public.awakening_commit(uuid,jsonb,jsonb), public.awakening_session(uuid,uuid,text,jsonb,boolean) to service_role;
commit;
