/**
 * Stores local calendar fields in a timezone-neutral UTC-shaped number.
 * Journal entries can then keep their original wall-clock date and time when
 * the device later changes time zones.
 */
export function encodeLocalDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function decodeLocalDateTime(encodedTimestamp: number) {
  const date = new Date(encodedTimestamp);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ).getTime();
}
