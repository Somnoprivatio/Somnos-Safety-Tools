const MODULE_ID = "somnos-safety-tools";
const OLD_MODULE_ID = "somno-safety-cards";
const SOCKET_NAME = `module.${MODULE_ID}`;
const FOLDER_NAME = "Somno's Safety Tools";
const OLD_FOLDER_NAME = "Somno Safety Cards";
const JOURNAL_NAME = "Somno's Safety Tools: How to Use";
const JOURNAL_PAGE_NAME = "Using the Safety Tools";

let startupJournalOpenedThisSession = false;

const CARD_DATA = {
  "all-stop": {
    id: "all-stop",
    name: "ALL STOP",
    macroName: "Safety Card: ALL STOP",
    img: `modules/${MODULE_ID}/assets/cards/all-stop.png`,
    description: "A player has called an ALL STOP to the current roleplay. Pause immediately, check in with the player to their comfort level of exposure, and identify the root cause of the issue.",
    accent: "#a91515"
  },
  "hazard-play": {
    id: "hazard-play",
    name: "HAZARD PLAY",
    macroName: "Safety Card: HAZARD PLAY",
    img: `modules/${MODULE_ID}/assets/cards/hazard-play.png`,
    description: "A player has indicated a hazard in the current roleplay. Fast forward through the current interaction, or pause and identify the root cause as needed.",
    accent: "#d0a21a"
  },
  "involve-me": {
    id: "involve-me",
    name: "INVOLVE ME",
    macroName: "Safety Card: INVOLVE ME",
    img: `modules/${MODULE_ID}/assets/cards/involve-me.png`,
    description: "A player has raised their hand. This means the player feels unheard or has not been able to engage with the roleplay effectively. Check in and make room for them.",
    accent: "#15917d"
  },
  "resume-play": {
    id: "resume-play",
    name: "RESUME PLAY",
    macroName: "Safety Card: Resume Play [GM]",
    img: `modules/${MODULE_ID}/assets/cards/resume-play.png`,
    description: "Issue resolved. Continue roleplaying, and be mindful of the potential triggers connected to the earlier card or cards.",
    accent: "#2d9b37"
  }
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "installedVersion", {
    name: "Installed Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "showStartupJournal", {
    name: "Show Startup Journal",
    hint: "Open the Somno's Safety Tools how-to journal when you load into this world. This is a per-user setting, so the GM and each player can disable it for themselves.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  game.socket.on(SOCKET_NAME, payload => handleSocketPayload(payload));

  Hooks.on("createJournalEntry", entry => {
    if (!isStartupJournal(entry)) return;
    window.setTimeout(() => maybeOpenStartupJournal(entry.id), 350);
  });

  const api = {
    callCard,
    resumePlay,
    showCardOverlay,
    installContent,
    showStartupJournal: () => maybeOpenStartupJournal(null, { force: true }),
    cards: CARD_DATA
  };

  game.somnoSafetyTools = api;
  game.somnoSafetyCards = api; // Backward compatibility for old manually-created macros.

  if (game.user.isGM) {
    await installContent();
  }

  window.setTimeout(() => maybeOpenStartupJournal(), 1200);
});

async function callCard(cardId) {
  const card = CARD_DATA[cardId];
  if (!card) {
    ui.notifications.error(`Somno's Safety Tools | Unknown card id: ${cardId}`);
    return;
  }

  const payload = {
    action: "call-card",
    cardId,
    userId: game.user.id,
    userName: game.user.name
  };

  game.socket.emit(SOCKET_NAME, payload);
  await handleSocketPayload(payload);
}

async function resumePlay() {
  if (!game.user.isGM) {
    ui.notifications.warn("Somno's Safety Tools | Only a GM can resume play.");
    return;
  }

  const payload = {
    action: "resume-play",
    cardId: "resume-play",
    userId: game.user.id,
    userName: game.user.name
  };

  game.socket.emit(SOCKET_NAME, payload);
  await handleSocketPayload(payload);
}

async function handleSocketPayload(payload = {}) {
  if (!payload.action) return;

  if (payload.action === "call-card") {
    await handleCalledCard(payload);
    return;
  }

  if (payload.action === "resume-play") {
    await handleResumePlay(payload);
    return;
  }

  if (payload.action === "startup-journal-ready") {
    window.setTimeout(() => maybeOpenStartupJournal(payload.journalId), 350);
  }
}

async function handleCalledCard(payload) {
  const card = CARD_DATA[payload.cardId];
  if (!card) return;

  if (game.user.isGM) {
    await safelyTogglePause(true);
    showCardOverlay(card, {
      mode: "gm-alert",
      header: `Player "${payload.userName ?? "Unknown"}" called a "${card.name}"`,
      subheader: card.description,
      showImage: true
    });
    return;
  }

  showCardOverlay(card, {
    mode: "player-card",
    header: "",
    subheader: ""
  });
}

async function handleResumePlay(payload) {
  const card = CARD_DATA["resume-play"];

  showCardOverlay(card, {
    mode: game.user.isGM ? "gm-resume" : "player-card",
    header: game.user.isGM ? "Resume Play broadcast sent." : "",
    subheader: game.user.isGM ? card.description : ""
  });

  if (game.user.isGM && payload.userId === game.user.id) {
    await safelyTogglePause(false);
    await postResumePlayToChat(card, payload.userName);
  }
}

async function safelyTogglePause(paused) {
  if (!game.user.isGM) return;
  if (game.paused === paused) return;

  try {
    await game.togglePause(paused, true);
  } catch (err) {
    console.error("Somno's Safety Tools | Failed to toggle pause state.", err);
    ui.notifications.error("Somno's Safety Tools | Failed to change the pause state. Check the console.");
  }
}

function showCardOverlay(card, options = {}) {
  if (!card) return;

  const existing = document.querySelector(".ssc-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.classList.add("ssc-overlay");
  overlay.style.setProperty("--ssc-accent", card.accent ?? "#ffffff");

  const hasHeader = Boolean(options.header);
  const hasSubheader = Boolean(options.subheader);
  const showImage = options.showImage !== false;

  overlay.innerHTML = `
    <section class="ssc-card-popout ${options.mode ?? ""}" role="dialog" aria-label="${escapeHtml(card.name)}">
      <button type="button" class="ssc-close" aria-label="Close">×</button>
      ${hasHeader ? `<header class="ssc-header">${escapeHtml(options.header)}</header>` : ""}
      ${hasSubheader ? `<div class="ssc-subheader">${escapeHtml(options.subheader)}</div>` : ""}
      ${showImage ? `<img class="ssc-card-image" src="${card.img}" alt="${escapeHtml(card.name)} Table Safety Card">` : ""}
      <footer class="ssc-hint">Click anywhere outside the card to dismiss.</footer>
    </section>
  `;

  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.remove();
  });

  overlay.querySelector(".ssc-close")?.addEventListener("click", () => overlay.remove());

  document.body.appendChild(overlay);
}

async function postResumePlayToChat(card, userName) {
  const content = `
    <div class="ssc-chat-card" style="border-color: ${card.accent};">
      <h2>${escapeHtml(card.name)}</h2>
      <img src="${card.img}" alt="${escapeHtml(card.name)} Table Safety Card">
      <p><strong>Issue Resolved:</strong> Continue roleplaying, and be mindful of the potential triggers connected to the earlier card or cards.</p>
    </div>
  `;

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: "Safety Tools" }),
      content,
      flags: {
        [MODULE_ID]: {
          cardId: card.id,
          sentBy: userName ?? game.user.name
        }
      }
    });
  } catch (err) {
    console.error("Somno's Safety Tools | Failed to create Resume Play chat message.", err);
    ui.notifications.error("Somno's Safety Tools | Failed to post Resume Play to chat. Check the console.");
  }
}

async function installContent() {
  if (!game.user.isGM) return;

  const version = game.modules.get(MODULE_ID)?.version ?? "0.5.0";

  try {
    const folder = await ensureMacroFolder();
    await ensureWorldMacros(folder?.id ?? null);
    const journal = await ensureStartupJournal();
    await game.settings.set(MODULE_ID, "installedVersion", version);

    if (journal?.id) {
      game.socket.emit(SOCKET_NAME, {
        action: "startup-journal-ready",
        journalId: journal.id
      });
    }

    ui.notifications.info("Somno's Safety Tools | Macros and how-to journal are installed. Drag macros from the Macro Directory to your hotbar manually.");
  } catch (err) {
    console.error("Somno's Safety Tools | Content install/update failed.", err);
    ui.notifications.error("Somno's Safety Tools | Content install/update failed. Check the console.");
  }
}

async function ensureMacroFolder() {
  let folder = game.folders.find(f => f.type === "Macro" && f.name === FOLDER_NAME);
  if (folder) return folder;

  const oldFolder = game.folders.find(f => f.type === "Macro" && f.name === OLD_FOLDER_NAME);
  if (oldFolder) {
    try {
      return await oldFolder.update({
        name: FOLDER_NAME,
        color: "#7a2020"
      });
    } catch (err) {
      console.warn("Somno's Safety Tools | Failed to rename the old macro folder. Creating a new one instead.", err);
    }
  }

  return Folder.create({
    name: FOLDER_NAME,
    type: "Macro",
    sorting: "a",
    color: "#7a2020"
  });
}

function buildMacroData(card, folderId = null) {
  const isResume = card.id === "resume-play";
  const command = isResume
    ? `game.somnoSafetyTools.resumePlay();`
    : `game.somnoSafetyTools.callCard("${card.id}");`;

  return {
    name: card.macroName,
    type: "script",
    scope: "global",
    img: card.img,
    command,
    folder: folderId,
    ownership: {
      default: isResume
        ? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
        : CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    },
    flags: {
      [MODULE_ID]: {
        cardId: card.id,
        safetyTool: true
      }
    }
  };
}

async function ensureWorldMacros(folderId) {
  for (const card of Object.values(CARD_DATA)) {
    const data = buildMacroData(card, folderId);
    const existing = findExistingWorldMacro(card);

    if (existing) {
      await existing.update({
        img: data.img,
        command: data.command,
        folder: data.folder,
        ownership: data.ownership,
        flags: data.flags
      });
    } else {
      await Macro.create(data);
    }
  }
}

function findExistingWorldMacro(card) {
  return game.macros.find(m => getRawFlag(m, MODULE_ID, "cardId") === card.id)
    ?? game.macros.find(m => getRawFlag(m, OLD_MODULE_ID, "cardId") === card.id)
    ?? game.macros.getName(card.macroName);
}

async function ensureStartupJournal() {
  if (!game.user.isGM) return findStartupJournal();

  const content = buildStartupJournalContent();
  const pageFormat = CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1;
  let journal = findStartupJournal();

  if (!journal) {
    journal = await JournalEntry.create({
      name: JOURNAL_NAME,
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      },
      flags: {
        [MODULE_ID]: {
          startupJournal: true
        }
      },
      pages: [{
        name: JOURNAL_PAGE_NAME,
        type: "text",
        text: {
          format: pageFormat,
          content
        },
        flags: {
          [MODULE_ID]: {
            startupJournalPage: true
          }
        }
      }]
    });

    return journal;
  }

  await journal.update({
    name: JOURNAL_NAME,
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    },
    flags: {
      [MODULE_ID]: {
        startupJournal: true
      }
    }
  });

  const page = journal.pages.find(p => getRawFlag(p, MODULE_ID, "startupJournalPage") || p.name === JOURNAL_PAGE_NAME);

  if (page) {
    await page.update({
      name: JOURNAL_PAGE_NAME,
      type: "text",
      text: {
        format: pageFormat,
        content
      },
      flags: {
        [MODULE_ID]: {
          startupJournalPage: true
        }
      }
    });
  } else {
    await journal.createEmbeddedDocuments("JournalEntryPage", [{
      name: JOURNAL_PAGE_NAME,
      type: "text",
      text: {
        format: pageFormat,
        content
      },
      flags: {
        [MODULE_ID]: {
          startupJournalPage: true
        }
      }
    }]);
  }

  return findStartupJournal() ?? journal;
}

function findStartupJournal(journalId = null) {
  if (journalId) {
    const byId = game.journal.get(journalId);
    if (isStartupJournal(byId)) return byId;
  }

  return game.journal.find(j => isStartupJournal(j))
    ?? game.journal.getName(JOURNAL_NAME);
}

function isStartupJournal(journal) {
  if (!journal) return false;
  return getRawFlag(journal, MODULE_ID, "startupJournal") === true
    || getRawFlag(journal, OLD_MODULE_ID, "startupJournal") === true
    || journal.name === JOURNAL_NAME;
}

function getRawFlag(document, scope, key) {
  return document?.flags?.[scope]?.[key];
}

async function maybeOpenStartupJournal(journalId = null, options = {}) {
  if (startupJournalOpenedThisSession && !options.force) return;

  const shouldOpen = options.force || game.settings.get(MODULE_ID, "showStartupJournal");
  if (!shouldOpen) return;

  const journal = findStartupJournal(journalId);
  if (!journal) return;

  startupJournalOpenedThisSession = true;

  try {
    await renderDocumentSheet(journal);
  } catch (err) {
    startupJournalOpenedThisSession = false;
    console.error("Somno's Safety Tools | Failed to open startup journal.", err);
  }
}

async function renderDocumentSheet(document) {
  const sheet = document.sheet;
  if (sheet?.render) {
    try {
      return await sheet.render(true);
    } catch (err) {
      return await sheet.render({ force: true });
    }
  }

  if (document.render) {
    try {
      return await document.render(true);
    } catch (err) {
      return await document.render({ force: true });
    }
  }

  if (game.user.isGM && document.show) {
    return document.show(false);
  }
}

function buildStartupJournalContent() {
  return `
    <section class="sst-journal">
      <h1>Somno's Safety Tools</h1>
      <p><strong>Purpose:</strong> This module gives the table fast, visible safety signals that can pause play without forcing a player to explain themselves in front of the group.</p>

      <h2>What the Module Adds</h2>
      <ul>
        <li><strong>Safety Card: ALL STOP</strong> stops the scene immediately and alerts the GM.</li>
        <li><strong>Safety Card: HAZARD PLAY</strong> warns the GM that the current content needs to be skipped, softened, or checked.</li>
        <li><strong>Safety Card: INVOLVE ME</strong> tells the GM that a player is feeling unheard or unable to engage.</li>
        <li><strong>Safety Card: Resume Play [GM]</strong> lets the GM tell everyone the issue is resolved, posts Resume Play to chat, and unpauses the game.</li>
      </ul>

      <h2>How Players Use It</h2>
      <ol>
        <li>Open the Macro Directory.</li>
        <li>Find the Somno's Safety Tools macro folder.</li>
        <li>Drag the player safety card macros to your hotbar.</li>
        <li>Click the correct macro when you need it.</li>
      </ol>

      <h2>What Happens When a Player Clicks a Card</h2>
      <ul>
        <li>The GM receives a centered alert naming the player and the selected card.</li>
        <li>Players see the selected card image in a centered popup.</li>
        <li>The GM client pauses the game.</li>
      </ul>

      <h2>How the GM Resumes Play</h2>
      <ol>
        <li>Handle the safety concern at the table's preferred level of privacy.</li>
        <li>Click <strong>Safety Card: Resume Play [GM]</strong>.</li>
        <li>The Resume Play card appears for everyone, posts to chat, and the game unpauses.</li>
      </ol>

      <h2>Turning Off This Startup Journal</h2>
      <p>This journal opens on startup by default. Each user can disable it for themselves:</p>
      <ol>
        <li>Open <strong>Configure Settings</strong>.</li>
        <li>Go to <strong>Module Settings</strong>.</li>
        <li>Find <strong>Somno's Safety Tools</strong>.</li>
        <li>Turn off <strong>Show Startup Journal</strong>.</li>
      </ol>

      <p><em>Note:</em> This module does not place macros on anyone's hotbar automatically. Hotbar placement is manual by design.</p>
    </section>
  `;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}
