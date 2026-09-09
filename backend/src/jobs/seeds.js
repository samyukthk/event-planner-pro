import { localizeDates } from './localize-dates.js';

/** Background jobs to run once when the server boots. */
export function seedBackgroundJobs() {
  const backfilled = localizeDates();
  if (backfilled > 0) {
    console.log(`Backfilled reminder datetimes for ${backfilled} work(s).`);
  }
}
