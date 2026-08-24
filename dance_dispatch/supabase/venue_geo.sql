-- Add geocoded coordinates to Venues, used for location check-in confirmation.
alter table public."Venues"
  add column if not exists latitude double precision null,
  add column if not exists longitude double precision null;
