-- ========================================================
-- NEXA CRM AUTOMATED SALES SYSTEM DATABASE SCHEMA
-- Copy and paste this script into your Supabase SQL Editor:
-- https://nyjhbeqpjfdhhvqvjzyy.supabase.co
-- ========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. LEADS TABLE (Excel / Google Sheet Import Target)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'meeting', 'won', 'lost')),
    assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_agent_name TEXT,
    last_contact TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    notes TEXT[] DEFAULT '{}',
    value NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. EMAIL AUTOMATION SEQUENCES (Templates)
CREATE TABLE IF NOT EXISTS public.email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_type TEXT UNIQUE NOT NULL CHECK (sequence_type IN ('welcome', 'reminder_1', 'reminder_2', 'reminder_3')),
    subject TEXT NOT NULL,
    body_template TEXT NOT NULL,
    delay_hours INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. EMAIL OUTBOUND LOGS & REPLY TRACKER
CREATE TABLE IF NOT EXISTS public.emails_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    lead_email TEXT NOT NULL,
    sequence_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'replied', 'no-response')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    replied_at TIMESTAMP WITH TIME ZONE
);

-- 5. MEETINGS & REMINDERS TABLE
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. PENDING SIGNUPS TABLE (Separate Queue for Unapproved Agent Requests)
CREATE TABLE IF NOT EXISTS public.pending_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_initials TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Allow public access for CRM demo/authed users
CREATE POLICY "Allow read/write access for authenticated users" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow lead access for agents" ON public.leads FOR ALL USING (true);
CREATE POLICY "Allow sequence access" ON public.email_sequences FOR ALL USING (true);
CREATE POLICY "Allow email history access" ON public.emails_sent FOR ALL USING (true);
CREATE POLICY "Allow meeting access" ON public.meetings FOR ALL USING (true);
CREATE POLICY "Allow access to pending signups" ON public.pending_signups FOR ALL USING (true);

-- DEFAULT EMAIL TEMPLATES INSERTS
INSERT INTO public.email_sequences (sequence_type, subject, body_template, delay_hours, is_active)
VALUES
('welcome', 'Welcome to Nexa — Quick question regarding {{company}}', 'Hi {{first_name}},\n\nThanks for your interest! I noticed you are leading outreach at {{company}}. I would love to show you how our automated sales workspace can help you double response rates.\n\nAre you open for a quick 10-min chat this week?\n\nBest,\nSales Team', 0, true),
('reminder_1', 'Re: Quick question regarding {{company}}', 'Hi {{first_name}},\n\nFollowing up on my previous note. Did you get a chance to check my email?\n\nLet me know if tomorrow works for a quick call.\n\nBest,\nSales Team', 48, true),
('reminder_2', 'How teams like {{company}} scale lead response by 3x', 'Hi {{first_name}},\n\nJust wanted to share how similar teams automated their lead follow-ups and saw a 3.1x increase in booked meetings.\n\nWould you be interested in a 5-minute video demo?\n\nBest,\nSales Team', 120, true),
('reminder_3', 'Final follow-up — should I close your file?', 'Hi {{first_name}},\n\nI haven''t heard back so I assume now might not be the best time. I will close your file for now, but feel free to reply whenever you''re ready!\n\nBest,\nSales Team', 192, true)
ON CONFLICT (sequence_type) DO NOTHING;
