import { isSupabaseConfigured } from '@/data';
import { getSupabase } from '@/data/supabase/client';

/**
 * Refresh a scoring station as soon as the tournament website assigns a
 * fixture, advances a bracket or changes a match. Polling remains the fallback.
 */
export function subscribePremierLeagueChanges(
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured) return () => {};
  try {
    const supabase = getSupabase();
    const refresh = () => onChange();
    const channel = supabase
      .channel(`scoring-station:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premier_league_competitions' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premier_league_nights' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premier_league_fixtures' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
