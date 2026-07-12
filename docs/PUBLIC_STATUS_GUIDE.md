# Public status writing and data guide

Ghostify's status pages are written for people using the extension. They are
not release notes, maintainer reminders, or instructions to ourselves.

## Write from the user's point of view

- Lead with what a user may experience.
- Say what is happening now. Mention another update only when a concrete
  schedule exists and someone is responsible for publishing it.
- Use calm, direct language: “Some users may…” or “We are investigating…”
- Avoid internal imperatives and workflow terms such as “must be published,”
  “maintainer-approved,” “repository proof,” or “verification build pending.”
- Avoid unsupported promises such as “we’ll share another update.” State the
  current condition and direct people to the status page instead.
- Keep each history entry contemporaneous. An entry may only state what was
  known on its recorded date; it must not describe a future outcome.
- Put internal evidence, reviewer, and release information in structured data,
  not in the public headline or summary.

## Calendar meaning

The status calendar is an event ledger, not a claim that Ghostify was manually
tested every day.

- **No known issue** means the latest recorded update was healthy and no newer
  issue had been recorded by that date.
- **Under review** means the latest recorded update was being investigated or
  rolled out.
- **Known issue** means an issue was publicly recorded and had not yet been
  followed by a resolved or healthy update.
- **No update** means there was not yet enough public status history to infer a
  state for that date.
- Dates before the Chrome Web Store launch and future dates are visually
  distinct and never presented as working.

The calendar reads its launch date, generated date, history events, and status
values from `site/src/app/statusData.json`. It renders every month of the
selected year and adds new years automatically. Do not hard-code a rolling
month range in the component.

Each history record also has an `eventType`. Use `release` or `fix` for positive
product updates, `verification` for a routine check, `incident` for confirmed
breakage, and `investigation` while reports are being reviewed. The calendar
uses this field so a fix or release never looks identical to a routine check.

## Updating status

1. Add a dated entry to `history` using the user-facing rules above.
2. Update `summary` to describe the current user impact.
3. Update platform entries and structured evidence fields when checks change.
4. Keep `release.publishedAt` as the original Store launch date.
5. Run the site build and inspect `/status` and `/status/history` at desktop,
   tablet, and phone widths.
