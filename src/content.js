// @ts-check
"use strict";

const bogusWorld = "-some-other-bogus-world-";

/**
 * @typedef {"world" | "world_nether" | "world_the_end" | typeof bogusWorld} WorldName
 */

/**
 * @typedef {Object} Player
 * @property {WorldName} world
 * @property {number} armor
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} health
 * @property {number} sort
 * @property {string} type
 * @property {string} account
 */

/**
 * @typedef {Object} UpdateResponse
 * @property {number} currentcount
 * @property {boolean} hasStorm
 * @property {Player[]} players
 * @property {boolean} isThundering
 * @property {number} confighash
 * @property {number} servertime
 * @property {number} timestamp
 * @property {unknown[]} updates
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
 */
async function getAllWorlds() {
  const timestamp = Date.now();

  /** @type {WorldName[]} */
  const worlds = ["world", "world_nether", "world_the_end"];
  /** @type {Record<string, Pick<Player, "name" | "world" | "x" | "y" | "z">>} */
  const users = {};

  /** @type {Promise<Response>[]} */
  const promises = worlds.map(world => {
    const url = new URL("https://tildes.nore.gg/standalone/MySQL_update.php");
    url.searchParams.append("world", world);
    url.searchParams.append("ts", timestamp.toString());

    return Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(reject, 1000 * 5)),
    ]);
  });

  for (const response of await Promise.all(promises)) {
    /** @type {UpdateResponse} */
    const data = await response.json();
    const tildesUsers =
        data
            .players
            .filter(player => player.name.startsWith("<span style=\"color:#0099cc\">"))
            .map(player => ({
              name: player.name?.match(/<span style="color:#0099cc">(.*)<\/span>/)?.[1] ?? "-bogus-user-",
              world: player.world,
              x: player.x,
              y: player.y,
              z: player.z,
            }));
    
    for (const user of tildesUsers) {
      if (users[user.name] && user.world === bogusWorld) {
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
  [bogusWorld]: "\u{1F310}", // Globe with meridians
};

/**
 * @type {Record<WorldName, string>}
 */
const worldNames = {
  world: "Overworld",
  world_nether: "Nether",
  world_the_end: "End",
  [bogusWorld]: "Unknown",
};

/**
 * Refreshes the online indicator for a user.
 * @param {HTMLAnchorElement} link
 * @param {Pick<Player, "name" | "world" | "x" | "y" | "z"> | undefined} onlineUser
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
  if (onlineUser.world !== bogusWorld) {
    url.searchParams.append("worldname", onlineUser.world);
    url.searchParams.append("mapname", onlineUser.world === "world" ? "surface" : "flat");
    url.searchParams.append("zoom", "6");
    url.searchParams.append("x", onlineUser.x.toString());
    url.searchParams.append("y", onlineUser.y.toString());
    url.searchParams.append("z", onlineUser.z.toString());
  }
  
  circle.classList.remove("offline");
  circle.classList.add("online");
  circle.textContent = worldIcons[onlineUser.world] || worldIcons[bogusWorld];
  circle.setAttribute("href", url.toString());
  circle.setAttribute("title", `Online - ${worldNames[onlineUser.world] || worldNames[bogusWorld]}`);
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
