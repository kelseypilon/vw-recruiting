/**
 * Generate an .ics (iCalendar) file string for a calendar event.
 *
 * Returns a valid VCALENDAR string that can be attached to emails
 * so recipients can add the event to their calendar with one click.
 */

interface IcsEvent {
  title: string;
  description?: string;
  location?: string; // URL or physical address
  startDate: Date;
  durationMinutes?: number; // default 60
  organizerName?: string;
  organizerEmail?: string;
}

/** Pad a number to 2 digits */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format a Date to iCal YYYYMMDDTHHMMSSZ (UTC) */
function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape special characters in iCal text values */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcs(event: IcsEvent): string {
  const start = event.startDate;
  const durationMs = (event.durationMinutes ?? 60) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  // Unique ID for the event
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@recruiting.app`;
  const now = toIcsUtc(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recruiting App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }
  if (event.organizerName && event.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${escapeIcs(event.organizerName)}:mailto:${event.organizerEmail}`
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}
