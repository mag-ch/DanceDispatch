import { RRule } from 'rrule'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server';

// Cron has no user session; use the service role when available so RLS doesn't block inserts.
async function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (url && key) {
    return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return createClient()
}

type Options = {
  seriesId?: string      // limit to one series (e.g. right after it is created or edited)
  regenerate?: boolean   // with seriesId: drop future occurrences first (rule/template changed)
}

// Parses a Postgres interval string such as '03:00:00' or '1 day 02:30:00'
function parseIntervalMs(interval: string | null): number {
  if (!interval) return 0
  const days = /(\d+)\s+days?/.exec(interval)
  const time = /(\d+):(\d+):(\d+)/.exec(interval)
  return (
    (days ? Number(days[1]) * 86_400_000 : 0) +
    (time ? (Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3])) * 1000 : 0)
  )
}

// The app stores event times as floating wall-clock values (read as UTC), so all comparisons use the series' local time
function floatingNow(tzid: string): Date {
  const wall = new Date().toLocaleString('sv-SE', { timeZone: tzid }).replace(' ', 'T')
  return new Date(wall + 'Z')
}

const GENERATION_WINDOW_DAYS = 30

/**
 * Ensures every active series has events for the next 30 days according to its rrule
 * (e.g. a weekly Friday series gets 4-5 instances). Safe to run daily: existing
 * occurrences are skipped. A series with no remaining occurrences is deactivated.
 */
export async function generateRecurringEvents({ seriesId, regenerate }: Options = {}) {
  const supabase = await getClient()

  let query = supabase.from('EventSeries').select('*').eq('active', true)
  if (seriesId) query = query.eq('id', seriesId)
  const { data: seriesList, error } = await query
  if (error) throw new Error(error.message)

  let created = 0
  let deactivated = 0
  const failures: { id: string; error: string }[] = []

  // One bad rule must not stop the rest of the batch
  for (const s of seriesList ?? []) {
    try {
      const localNow = floatingNow(s.tzid)
      const nowIso = localNow.toISOString()

      // Rule or template changed: drop future occurrences, the next one is rebuilt below
      if (seriesId && regenerate) {
        const { error: deleteError } = await supabase
          .from('Events')
          .delete()
          .eq('series_id', s.id)
          .gt('start', nowIso)
        if (deleteError) throw new Error(deleteError.message)
      }

      const rule = new RRule({
        ...RRule.parseString(s.rrule.replace(/^RRULE:/i, '')),
        dtstart: new Date(s.dtstart + 'Z'),
      })

      // COUNT is counted from dtstart, so COUNT/UNTIL end the series correctly
      if (!rule.after(localNow, true)) {
        const { error: deactivateError } = await supabase
          .from('EventSeries')
          .update({ active: false })
          .eq('id', s.id)
        if (deactivateError) throw new Error(deactivateError.message)
        deactivated += 1
        continue
      }

      const windowEnd = new Date(localNow.getTime() + GENERATION_WINDOW_DAYS * 86_400_000)
      const occurrences = rule.between(localNow, windowEnd, true)
      if (!occurrences.length) continue

      // Same convention as submitEvent: wall-clock time stored as-is (no zone conversion)
      const durationMs = parseIntervalMs(s.duration)
      const rows = occurrences.map((occurrence) => ({
        title: s.title,
        start: occurrence.toISOString(),
        end: durationMs ? new Date(occurrence.getTime() + durationMs).toISOString() : null,
        location: s.location,
        description: s.description,
        flyer_url: s.flyer_url,
        external_url: s.external_url,
        price: s.price,
        series_id: s.id,
      }))

      // Existing (series_id, start) rows are skipped, so re-runs only add what is missing
      const { data, error } = await supabase
        .from('Events')
        .upsert(rows, { onConflict: 'series_id,start', ignoreDuplicates: true })
        .select('id')
      if (error) throw new Error(error.message)
      created += data?.length ?? 0
    } catch (e) {
      failures.push({ id: s.id, error: String(e) })
      console.error('series failed', s.id, e)
    }
  }

  return { created, deactivated, failures }
}

