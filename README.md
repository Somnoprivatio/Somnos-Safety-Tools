# Somno's Safety Tools

A standalone, system-agnostic Foundry VTT v14 module for table safety tools.

## Version

- Module Version: `0.5.0`
- Minimum Foundry Version: `14`
- Verified Foundry Version: `14`

## What it does

- Installs four world macros into a `Somno's Safety Tools` macro folder with preassigned ownership.
- Creates a world journal named `Somno's Safety Tools: How to Use`.
- Opens that journal on startup for GMs and players by default.
- Adds a per-user module setting named `Show Startup Journal` so the GM and each player can disable the startup journal for themselves.

## Macros

Player macros:

- `Safety Card: ALL STOP`
- `Safety Card: HAZARD PLAY`
- `Safety Card: INVOLVE ME`

GM macro:

- `Safety Card: Resume Play [GM]`

## Behavior

When a player activates one of the three player macros:

1. The GM receives a centered alert that says which player called which card.
2. Every non-GM player receives the selected card image in a centered popup.
3. The game is paused by the GM client.

When the GM activates `Safety Card: Resume Play [GM]`:

1. Everyone receives the Resume Play card popup.
2. The Resume Play card is posted to chat.
3. The game is unpaused.

## Startup Journal

The module creates a journal named `Somno's Safety Tools: How to Use` that explains:

- What each safety card does.
- How players drag macros to their hotbars.
- What happens when a safety card is clicked.
- How the GM resumes play.
- How each user can disable the journal popup in module settings.

To disable the startup journal:

1. Open **Configure Settings**.
2. Go to **Module Settings**.
3. Find **Somno's Safety Tools**.
4. Disable **Show Startup Journal**.

This is a client-side setting, so it only affects the user who changes it.

## Install

TBD

## Notes

- The player macros ask the GM client to pause the game because normal players usually cannot pause worlds directly.