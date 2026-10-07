# Pyde Design Spec

A Figma plugin that attaches a **design spec card** to a section (or a root frame). The card holds what developers — and the Claude instance they work with — need to know before implementing the design:

- Status: Work in progress · In review · Ready for development
- Owners: Design, Development, Product
- Jira links and Slack threads
- Free-text notes
- Last updated by / when (automatic)

The card looks like a sticky note whose color follows the status (yellow = in progress, purple = in review, green = ready). It is a normal Figma frame made of plain text layers, so Figma MCP and Dev Mode read it like any other part of the design. The same data is also stored as JSON on the section (shared plugin data, including the section's id), which is what the plugin reads and edits.

## Install

1. Download this repo (Code → Download ZIP) and unzip it.
2. In Figma: Plugins → Development → Import plugin from manifest… → select `manifest.json`.

## Use

1. Select a section (or a frame placed directly on the page / directly inside a section) and run the plugin.
2. Fill in the form and click **Add spec card**.
   - For a section, the card is placed **inside** the section, to the right of the existing content. The section grows to fit it; nothing else moves.
   - For a frame (a screen), the card is placed next to the frame, so it never looks like part of the UI.
3. To edit later, select the section or the card and click **Edit design spec** in the right panel (or run the plugin again).

Don't edit the card's text by hand — it is regenerated from the form on every save.

### Ready for development

- Marking a spec **Ready for development** renames the section/frame to `✅ Ready · <name>`. Moving it back to another status (or removing the spec) removes the prefix. The prefix is set in `READY_PREFIX` in `code.js`.
- At that moment the plugin stores a fingerprint of the design. When someone later opens the plugin on that section and the design has changed, the plugin and the card show a warning: *"The design changed after it was marked Ready for development"*. From the warning you can **accept the changes** (keep Ready, new baseline) or **move it to In review**.
- Detection runs only when the plugin is open and the section is selected, so it doesn't slow down large files.

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
- If the card shows "The design changed after it was marked Ready for development",
  confirm the details with the design owner before implementing.
```

## Releasing a new version

1. Bump `VERSION` in `ui.html`.
2. Bump `version` in `version.json` to the same number.
3. Push to `main`. Anyone running an older version will see an "Update required" screen with a download link.

The version check is mandatory: the plugin shows a blocking screen until it has verified the version on GitHub, and if it can't (offline, GitHub down) it stays blocked with a "Try again" button.

Note: `version.json` must stay in the repo root on `main` and the repo must be public, because the plugin reads it from `raw.githubusercontent.com`.
