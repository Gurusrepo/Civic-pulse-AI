# Citizen portal language foundation

The portal currently has English-only interface text. A fixed-English locale
provider has been added and is currently used by navigation and Help & Support.
Do not expose a language selector until the complete citizen experience is
translated and reviewed; a navigation-only switch would misrepresent the
experience.

## Intended architecture

- Keep UI messages in locale catalogs, organized by feature namespace
  (`navigation`, `auth`, `complaints`, `dashboard`, `announcements`, `profile`,
  `notifications`, and `help`).
- Resolve messages through one locale provider/translation function. Support
  named interpolation values rather than concatenating translated fragments.
- Keep status labels in domain-specific keys. A complaint receipt status, a
  civic issue workflow status, and an AI assessment status must not share
  ambiguous labels.
- Keep validation messages addressable by stable field/rule keys. If server
  validation needs localization, return stable error codes and parameters;
  do not translate by matching English error prose.
- Use English as the fallback locale. Add Tamil as an available locale only
  after its catalog has full coverage and a fluent review.

## Required coverage before enabling Tamil

The citizen locale must cover navigation, sign-in and registration, all
complaint form labels and validation messages, dashboard and statistics,
complaint listing/details/statuses/timeline/resolution verification,
announcements, profile, notification states/actions, and all Help & Support
content. Shared loading, empty, retry, and error states must also be covered.

Announcement titles and descriptions are administrator-authored content, not
interface strings. A future Tamil switch must not silently machine-translate
them. Before enabling it, decide how administrators will provide language
variants and ensure the citizen view has an explicit, understandable fallback
when a translation is unavailable.

No runtime language switch is available yet. Existing screens outside
navigation and Help & Support still contain inline English text and must be
migrated to the catalog before a locale can be switched. Do not claim Tamil
support until the coverage above is complete.
