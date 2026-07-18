alter table public.projects
  drop constraint if exists projects_color_key;

alter table public.projects
  add constraint projects_color_key
  check (
    color_key in (
      'orange',
      'coral',
      'red',
      'ruby',
      'rose',
      'pink',
      'magenta',
      'plum',
      'violet',
      'indigo',
      'blue',
      'sky',
      'cyan',
      'teal',
      'emerald',
      'green',
      'lime',
      'yellow',
      'amber',
      'terracotta',
      'brown',
      'sand',
      'slate',
      'gray'
    )
  );
