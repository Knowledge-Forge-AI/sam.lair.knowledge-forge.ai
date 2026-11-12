# Design and editorial boundaries

The personal variant follows Terminal Nova Developer’s semantic hierarchy, compact mono interface and explicit visual states. It is implemented locally without adding a theme package dependency. Design reference: `starlight-theme-terminal-nova`, commit `9639364f3953e5590beccd089b5288591d36d3a7`, `styles/appearances-sttn/developer.css`. No upstream CSS is copied.

Dark colors derive from the owner’s green-on-black terminal and its cyan, purple, lime and amber prompt accents. Light mode uses a colored sage canvas rather than a white page. Body copy uses system sans fonts; headings and interface prefer locally available JetBrains Mono with system monospace fallbacks. No font files are distributed or requested remotely.

Glass is progressive enhancement. Opaque fallbacks, native controls, visible keyboard focus, a skip link, reduced-motion behavior and print styling remain available. No motion is necessary to understand content. Search and project filtering progressively enhance the complete static journal; without scripts all entries remain readable.

The supplied photograph is a private generation reference. Only the selected AI-generated transparent illustration ships. The owner requested blue eyes, a clean natural smile and omission of the name tag. No biography is inferred from the photograph.

Release dates come from public GitHub release records. Milestones link their public records. Retrospective writing dates are separately visible. Release availability is described as recorded at that event, and no roadmap feature is presented as shipped.

The journal’s visible dates, RSS publication dates and structured-data publication dates intentionally follow the original event date at the owner’s request. The separately displayed retrospective writing date and structured dateModified identify when backfilled text was written. The original authored essay keeps its original date and bytes. Its Starlight date translation uses UTC so local build timezones cannot shift the calendar day. The retained Starlight archive uses its existing separate appearance control.
