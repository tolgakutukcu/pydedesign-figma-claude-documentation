# Pyde Design Spec

A Figma plugin that attaches a **design spec card** to a section (or a root frame). The card holds what developers — and the Claude instance they work with — need to know before implementing the design:

- Status: Work in progress · In review · Ready for development
- Owners: Design, Development, Product
- Jira links and Slack threads
- Free-text notes
- Last updated by / when (automatic)

The card looks like a yellow sticky note; the status shows as a colored label on it. It is a normal Figma frame made of plain text layers, so Figma MCP and Dev Mode read it like any other part of the design. The same data is also stored as JSON on the section (shared plugin data, including the section's id), which is what the plugin reads and edits.

## Install

1. Download this repo (Code → Download ZIP) and unzip it.
2. In Figma: Plugins → Development → Import plugin from manifest… → select `manifest.json`.

## Use

1. Select a section (or a frame placed directly on the page / directly inside a section) and run the plugin.
2. Fill in the form and click **Add spec card**.
   - For a section, the card is placed **inside** the section, in its top-left corner (96 px from the left and top). The existing content moves down to start 96 px below the card, and the section grows to fit. When the card later gets taller or shorter, the content below it moves with it.
   - For a frame (a screen), the card is placed next to the frame, so it never looks like part of the UI.
3. To edit later, select the section or the card and click **Edit design spec** in the right panel (or run the plugin again).

Don't edit the card's text by hand — it is regenerated from the form on every save.

### Card language

Settings → **Card language (this file)** switches the cards between English and Turkish. It is a file setting: everyone working in the file gets the same language, and changing it re-renders every existing card in the file. The card's layer name (`📋 Design Spec — …`) and the status suffix on the section name stay in English, so the instructions for Claude below keep working. The plugin interface language is a separate, personal setting.

### Status in the layer name

The section/frame name shows its status after an em dash, updated on every save:

- `Checkout Flow — 🚧 Work in progress`
- `Checkout Flow — 👀 In review`
- `Checkout Flow — ✅ Ready for development`

Removing the spec removes the suffix. Labels and emojis are in `STATUSES` in `code.js`.

### Overview

The **Overview** tab lists every spec in the file with its status. The current page is rescanned each time you open the tab, using Figma's indexed search, so it is fast even in big files. Other pages show their last known state. **Scan all pages** loads every page and refreshes everything; it can take a while in large files.

## Owner suggestions

Figma only lets plugins see the people who have the file open right now, so name suggestions are combined from:

1. **`team.json` in this repo**: the team roster, per role. Edit it and push to `main`; everyone gets the new list the next time they open the plugin (no version bump needed).
2. Every owner saved in a spec in the current file (shared with the whole team).
3. Names you typed before, in any file (stored only on your machine).
4. People who currently have the file open, and you.

```json
{
  "design": ["Name Surname"],
  "development": ["Name Surname"],
  "product": ["Name Surname"]
}
```

Names listed for a role are suggested first in that role's field.

## For developers using Claude Code + Figma MCP

Add this to your project's `CLAUDE.md` so Claude always reads the card:

```md
## Figma designs
Before implementing a Figma section or screen, look for a layer named "📋 Design Spec — …"
inside the section (or next to the frame). It contains the status, owners, Jira / Slack links
and the designer's notes. Treat the notes as requirements.
- If the status is not "Ready for development", say so before implementing.
```

## Releasing a new version

1. Bump `VERSION` in `ui.html`.
2. Bump `version` in `version.json` to the same number.
3. Push to `main`. Anyone running an older version will see an "Update required" screen with a download link.

The version check is mandatory: the plugin shows a blocking screen until it has verified the version on GitHub, and if it can't (offline, GitHub down) it stays blocked with a "Try again" button.

Note: `version.json` must stay in the repo root on `main` and the repo must be public, because the plugin reads it from `raw.githubusercontent.com`.
