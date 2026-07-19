export function premierLeagueErrorText(
  t: (key: string) => string,
  cause: unknown,
): string {
  const code = cause instanceof Error ? cause.message : 'UNKNOWN';
  const key = `premierLeague.error.${code}`;
  const translated = t(key);
  return translated === key ? t('premierLeague.error.UNKNOWN') : translated;
}

