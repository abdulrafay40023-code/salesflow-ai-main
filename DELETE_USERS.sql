-- =============================================
-- Run this in Supabase SQL Editor:
-- https://nyjhbeqpjfdhhvqvjzyy.supabase.co
-- Go to: SQL Editor > New Query > Paste > Run
-- =============================================

-- Step 1: Delete all non-admin profiles from the profiles table
DELETE FROM public.profiles
WHERE email != 'garryamelia6265@gmail.com';

-- Step 2: Delete all non-admin leads (clean slate)
DELETE FROM public.leads;

-- Step 3: Delete all emails sent
DELETE FROM public.emails_sent;

-- Step 4: Delete all meetings
DELETE FROM public.meetings;

-- Step 5: Delete all auth users EXCEPT the admin (garryamelia6265@gmail.com)
-- This directly removes from auth.users
DELETE FROM auth.users
WHERE email != 'garryamelia6265@gmail.com';

-- Verify: Check remaining users
SELECT id, email, created_at FROM auth.users;
