/**
 * @typedef {Object} PlayerData
 * @property {string} world
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Player
 * @property {string} name
 * @property {boolean} online
 * @property {PlayerData} data
 */

/**
 * @typedef {Object} StatusResponse
 * @property {Player[]} statuses
 */

const bogusWorld = "-some-other-bogus-world-";

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
  const timestamp = parseInt(sessionStorage.getItem("lastFetchedAt"), 10);
  if (isNaN(timestamp)) {
    return 0;
  }

  return timestamp;
}

/**
 * Gets all players in all worlds.
 * @param {string[]} usernames
 */
async function getStatuses(usernames) {
  const timestamp = Date.now();
  
  /** @type {StatusResponse} */
  const response = await fetch("https://tildes.nore.gg/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ usernames }),
  }).then(res => res.json());

  setLastFetchedAt(timestamp);

  return response.statuses;
}

function addPlaceholders() {
  // Give everyone an offline indicator to start
  for (const link of document.querySelectorAll("a.link-user")) {
    const circle = document.createElement("a");
    circle.classList.add("mc-online-indicator");
    circle.classList.add("offline");
    circle.setAttribute("href", "#");
    circle.title = "Offline";
    circle.textContent = "\u200B"; // Zero-width space
    link.after(circle);
  }
}

/**
 * OnClick handler for online indicators.
 * @param {MouseEvent} event
 */
async function onClick(event) {
  const linkExpired = (Date.now() - getLastFetchedAt()) > 1000 * 5;
  if (!linkExpired) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  /** @type {HTMLAnchorElement} */
  const link = event.target;
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

  window.open(link.href, "_blank");
}

const worldIcons = {
  world: "\u{1F30E}", // Globe with Americas
  world_nether: "\u{1F525}", // Fire
  world_the_end: "\u{1F30C}", // Milky Way
  [bogusWorld]: "\u{1F310}", // Globe with meridians
};

const worldNames = {
  world: "Overworld",
  world_nether: "Nether",
  world_the_end: "End",
  [bogusWorld]: "Unknown",
};

/**
 * Refreshes the online indicator for a user.
 * @param {HTMLAnchorElement} link
 * @param {Player} onlineUser
 */
function refreshOnlineIndicator(link, onlineUser) {
  let circle = link.nextElementSibling;
  if (!circle || !circle.classList.contains("mc-online-indicator")) {
    circle = document.createElement("a");
    circle.classList.add("mc-online-indicator");
    link.after(circle);
  }

  if (!onlineUser) {
    circle.classList.remove("online");
    circle.classList.add("offline");
    circle.textContent = "\u200B"; // Zero-width space
    circle.title = "Offline";
    circle.setAttribute("href", "#");
    circle.removeEventListener("click", onClick);
    return;
  }

  const url = new URL("https://tildes.nore.gg/");
  if (onlineUser.world !== bogusWorld) {
    url.searchParams.append("worldname", onlineUser.world);
    url.searchParams.append("mapname", onlineUser.world === "world" ? "surface" : "flat");
    url.searchParams.append("zoom", "6");
    url.searchParams.append("x", onlineUser.x.toString());
    url.searchParams.append("y", "64");
    url.searchParams.append("z", onlineUser.z.toString());
  }
  
  circle.classList.remove("offline");
  circle.setAttribute("href", url.toString());
  circle.setAttribute("target", "_blank");
  circle.setAttribute("rel", "noopener noreferrer");
  circle.classList.add("online");
  circle.textContent = worldIcons[onlineUser.world] || worldIcons[bogusWorld];
  circle.title = `Online - ${worldNames[onlineUser.world] || worldNames[bogusWorld]}`;
  circle.addEventListener("click", onClick);
}

async function refreshOnlineIndicators() {
  const userLinks = Array.from(document.querySelectorAll("a.link-user"));
  const usernames = userLinks.map(link => link.textContent.replace(/^@/, ""));
  const usernamesDeduped = Array.from(new Set(usernames));
  const onlineUsers = await getStatuses(usernamesDeduped);

  console.log(onlineUsers);
  
  for (const onlineUser of onlineUsers) {
    const link = userLinks.find(link => link.textContent.replace(/^@/, "") === onlineUser.name);
    if (!link) {
      continue;
    }

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
