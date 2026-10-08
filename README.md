# Pyde Design ReadMe

*Tasarım Künyesi* — a Figma plugin that adds a **Design ReadMe** card to a section. The card holds what developers — and the Claude instance they work with — need to know before implementing the design:

- Status: Work in progress · In review · Ready for development
- Owners: Design, Development, Product
- Jira links and Slack threads
- Free-text notes
- Last updated by / when (automatic)

The card looks like a yellow sticky note with a colored status label, and is always written in English. It is a normal Figma frame made of plain text layers, so Figma MCP and Dev Mode read it like any other part of the section. The same data is also stored as JSON on the section (shared plugin data, including the section's id), which is what the plugin reads and edits.

## Install

1. Download this repo (Code → Download ZIP) and unzip it.
2. In Figma: Plugins → Development → Import plugin from manifest… → select `manifest.json`.

## Use

1. Select a section and run the plugin. A ReadMe can only be added to a section, not to a frame.
2. Fill in the form and click **Add Design ReadMe**.
   - The card is placed inside the section, in its top-left corner (96 px from the left and top). The existing content moves down to start 96 px below the card, and the section grows to fit. When the card later gets taller or shorter, the content below it moves with it.
3. To edit later, select the section or the card and click **Edit Design ReadMe** in the right panel (or run the plugin again).

Don't edit the card's text by hand — it is regenerated from the form on every save.

The plugin interface can be switched between English and Turkish in Settings. That only changes the interface for you; the card stays in English.

### Status in the layer name

The section name shows its status after an em dash, updated on every save:

- `Checkout Flow — 🚧 Work in progress`
- `Checkout Flow — 👀 In review`
- `Checkout Flow — ✅ Ready for development`

Removing the ReadMe removes the suffix. Labels and emojis are in `STATUSES` in `code.js`.

### Overview

The **Overview** tab lists every ReadMe in the file with its status. The current page is rescanned each time you open the tab, using Figma's indexed search, so it is fast even in big files. Other pages show their last known state. **Scan all pages** loads every page and refreshes everything; it can take a while in large files.

## Owner suggestions

Any name can be typed into any owner field. Figma only lets plugins see the people who have the file open right now, so name suggestions are combined from:

1. **`team.json` in this repo**: a plain list of names. Edit it and push to `main`; everyone gets the new list the next time they open the plugin (no version bump needed).
2. Every owner saved in a ReadMe in the current file (shared with the whole team).
3. Names you typed before, in any file (stored only on your machine).
4. People who currently have the file open, and you.

```json
["Name Surname", "Name Surname"]
```

The repo is public, so `team.json` should only contain names. To refresh it, use **Copy member names** in the #general channel's member list in Slack (no admin rights needed) and turn the comma-separated names into the list above.

## For developers using Claude Code + Figma MCP

Add this to your project's `CLAUDE.md` so Claude always reads the card:

```md
## Figma designs
Before implementing a Figma section, look for a layer named "📋 Design ReadMe — …" inside it.
If you were given a frame inside a section, read the parent section's Design ReadMe too.
It contains the status, owners, Jira / Slack links and the designer's notes.
Treat the notes as requirements.
- If the status is not "Ready for development", say so before implementing.
```

## Releasing a new version

1. Bump `VERSION` in `ui.html`.
2. Bump `version` in `version.json` to the same number.
3. Push to `main`. Anyone running an older version will see an "Update required" screen with a download link.

The version check is mandatory: the plugin shows a blocking screen until it has verified the version on GitHub, and if it can't (offline, GitHub down) it stays blocked with a "Try again" button.

Note: `version.json` must stay in the repo root on `main` and the repo must be public, because the plugin reads it from `raw.githubusercontent.com`.
