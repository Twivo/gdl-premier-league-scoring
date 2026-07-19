-- Huit joueurs de la Premier League.
-- Exécutable plusieurs fois : les noms déjà présents ne sont pas dupliqués.

insert into public.players (name, active)
select seed.name, true
from (
  values
    ('John Shanahan'),
    ('Yannick Cainzos'),
    ('Juan Lopez'),
    ('Thierry Calzolari'),
    ('Philippe Piccolet'),
    ('Fernando Santos'),
    ('Alain Baechler'),
    ('Patrick Rey')
) as seed(name)
where not exists (
  select 1
  from public.players existing
  where lower(existing.name) = lower(seed.name)
);

select id, name, active
from public.players
where lower(name) in (
  'john shanahan',
  'yannick cainzos',
  'juan lopez',
  'thierry calzolari',
  'philippe piccolet',
  'fernando santos',
  'alain baechler',
  'patrick rey'
)
order by name;
