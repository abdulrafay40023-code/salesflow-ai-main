-- ================================================================
-- TEALS CRM -- REPORTING SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor.
-- This adds 5 columns to the leads table for event-based reporting.
-- Existing leads will have NULL for these columns.
-- All new events will be tracked going forward.
-- ================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS imported_by       TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booked_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_at            TIMESTAMPTZ;

-- Indexes for faster date-range queries on the Reports page
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at   ON public.leads (assigned_at);
CREATE INDEX IF NOT EXISTS idx_leads_contacted_at  ON public.leads (contacted_at);
CREATE INDEX IF NOT EXISTS idx_leads_booked_at     ON public.leads (booked_at);
CREATE INDEX IF NOT EXISTS idx_leads_won_at        ON public.leads (won_at);
CREATE INDEX IF NOT EXISTS idx_leads_imported_by   ON public.leads (imported_by);
