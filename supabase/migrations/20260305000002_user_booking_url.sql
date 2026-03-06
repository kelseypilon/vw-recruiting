-- Add google_booking_url to users table for interview scheduling links
alter table users
  add column if not exists google_booking_url text;
