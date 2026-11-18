import { BadRequestException } from '@nestjs/common';

export function localDateStart(date: Date, timeZone: string): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetWallTime = Date.UTC(year, month, day);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidate = targetWallTime;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]));
    const observedWallTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const correction = targetWallTime - observedWallTime;
    candidate += correction;
    if (correction === 0) return new Date(candidate);
  }

  throw new BadRequestException('The booking date does not have a valid local-day boundary in the organization timezone');
}
