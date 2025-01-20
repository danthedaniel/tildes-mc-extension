// @ts-check
"use strict";

/**
 * @typedef {"world" | "world_nether" | "world_the_end"} WorldName
 */

/**
 * @typedef {Object} BlueMapResponse
 * @property {Player[]} players
 */

/**
 * @typedef {Object} Player
 * @property {string} uuid
 * @property {string} name
 * @property {boolean} foreign
 * @property {{ x: number, y: number, z: number }} position
 * @property {{ pitch: number, yaw: number, roll: number }} rotation
 */

/**
 * @typedef {Player & { world: WorldName }} PlayerWithWorld
 */

/**
 * @param {number} timestamp
 */
function setLastFetchedAt(timestamp) {
  sessionStorage.setItem("lastFetchedAt", timestamp.toString());
}

/**
 * @returns {number}
 */
function getLastFetchedAt() {
  const timestamp = parseInt(sessionStorage.getItem("lastFetchedAt") ?? "0", 10);
  if (isNaN(timestamp)) {
    return 0;
  }

  return timestamp;
}

/**
 * Gets all players in all worlds.
 * @returns {Promise<PlayerWithWorld[]>}
 */
async function getAllWorlds() {
  const timestamp = Date.now();

  /** @type {WorldName[]} */
  const worlds = ["world", "world_nether", "world_the_end"];
  /** @type {Record<string, PlayerWithWorld>} */
  const users = {};

  const promises = worlds.map(async world => {
    const url = new URL(`https://tildes.nore.gg/maps/${world}/live/players.json?${timestamp}`);

    /** @type {Response} */
    const response = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(reject, 1000 * 5)),
    ]);

    return /** @type {[WorldName, Response]} */ ([world, response]);
  });

  for (const [world, response] of await Promise.all(promises)) {
    /** @type {BlueMapResponse} */
    const data = await response.json();
    const worldUsers = data.players.filter(player => !player.foreign).map(player => ({ ...player, world }));
    
    for (const user of worldUsers) {
      if (typeof users[user.name] !== "undefined") {
        continue;
      }

      users[user.name] = user;
    }
  }

  setLastFetchedAt(timestamp);

  return Object.values(users);
}

function addPlaceholders() {
  // Give everyone an offline indicator to start
  for (const link of document.querySelectorAll("a.link-user")) {
    const circle = document.createElement("a");
    circle.classList.add("mc-online-indicator");
    circle.classList.add("offline");
    link.after(circle);
  }
}

/**
 * OnClick handler for online indicators.
 * @param {Event} event
 */
async function onClick(event) {
  const linkExpired = (Date.now() - getLastFetchedAt()) > 1000 * 5;
  if (!linkExpired) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const link = event.target;
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  link.classList.add("loading");

  try {
    await refreshOnlineIndicators();
  } catch (/** @type {unknown} */ e) {
    console.error(e);
  } finally {
    link.classList.remove("loading");
  }

  if (link.href === "#") {
    return;
  }

  window.open(link.href, "_blank", "noopener noreferrer");
}

/**
 * @type {Record<WorldName, string>}
 */
const worldIcons = {
  world: "\u{1F30E}", // Globe with Americas
  world_nether: "\u{1F525}", // Fire
  world_the_end: "\u{1F30C}", // Milky Way
};

/**
 * @type {Record<WorldName, string>}
 */
const worldNames = {
  world: "Overworld",
  world_nether: "Nether",
  world_the_end: "End",
};

/**
 * Refreshes the online indicator for a user.
 * @param {HTMLAnchorElement} link
 * @param {PlayerWithWorld | undefined} onlineUser
 */
function refreshOnlineIndicator(link, onlineUser) {
  const circle = link.nextElementSibling;
  if (!circle || !circle.classList.contains("mc-online-indicator")) {
    return;
  }

  if (!onlineUser) {
    circle.classList.remove("online");
    circle.classList.add("offline");
    circle.textContent = "";
    circle.removeAttribute("href");
    circle.removeAttribute("title");
    circle.removeAttribute("target");
    circle.removeAttribute("rel");
    circle.removeEventListener("click", onClick);
    return;
  }

  const url = new URL("https://tildes.nore.gg/");
  url.hash = `#${onlineUser.world}:${onlineUser.position.x}:${onlineUser.position.y}:${onlineUser.position.z}:128:0:0:0:0:perspective`;
  
  circle.classList.remove("offline");
  circle.classList.add("online");
  circle.textContent = worldIcons[onlineUser.world];
  circle.setAttribute("href", url.toString());
  circle.setAttribute("title", `Online - ${worldNames[onlineUser.world]}`);
  circle.setAttribute("target", "_blank");
  circle.setAttribute("rel", "noopener noreferrer");
  circle.addEventListener("click", onClick);
}

async function refreshOnlineIndicators() {
  const onlineUsers = await getAllWorlds();

  const selectors = [
    ".comment-header a.link-user",
    ".topic-full-byline a.link-user",
    ".topic-info a.link-user",
  ];
  
  for (const link of document.querySelectorAll(selectors.join(", "))) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const onlineUser = onlineUsers.find(user => user.name === link.textContent);

    refreshOnlineIndicator(link, onlineUser);
  }
}

async function addOnlineIndicators() {
  addPlaceholders();

  await refreshOnlineIndicators();

  setInterval(async () => {
    try {
      await refreshOnlineIndicators();
    } catch (/** @type {unknown} */ e) {
      console.error(e);
    }
  }, 1000 * 60);
}

addOnlineIndicators();
