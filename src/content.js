/**
 * @typedef {Object} Player
 * @property {string} world
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
 */

const bogusWorld = "-some-other-bogus-world-";

async function getAllWorlds() {
  const worlds = ["world", "world_nether", "world_the_end"];
  /** @type {Record<string, Pick<Player, "name" | "world" | "x" | "y" | "z">>} */
  const users = {};

  const timestamp = Date.now();
  const promises = worlds.map(world => {
    const url = new URL("https://tildes.nore.gg/standalone/MySQL_update.php");
    url.searchParams.append("world", world);
    url.searchParams.append("ts", timestamp);

    return fetch(url);
  });

  for (const response of await Promise.all(promises)) {
    /** @type {UpdateResponse} */
    const data = await response.json();
    const tildesUsers =
        data
            .players
            .filter(player => player.name.startsWith("<span style=\"color:#0099cc\">"))
            .map(player => ({
              name: player.name.match(/<span style="color:#0099cc">(.*)<\/span>/)[1],
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

  return Object.values(users);
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

async function refreshOnlineIndicators() {
  const onlineUsers = await getAllWorlds();
  
  for (const link of document.querySelectorAll("a.link-user")) {
    const circle = link.nextElementSibling;

    const onlineUser = onlineUsers.find(user => user.name === link.textContent);
    if (!onlineUser) {
      circle.classList.remove("online");
      circle.classList.add("offline");
      circle.textContent = "\u200B"; // Zero-width space
      circle.title = "Offline";
      circle.setAttribute("href", "#");
      continue;
    }

    const url = new URL("https://tildes.nore.gg/");
    if (onlineUser.world !== bogusWorld) {
      url.searchParams.append("worldname", onlineUser.world);
      url.searchParams.append("mapname", onlineUser.world === "world" ? "surface" : "flat");
      url.searchParams.append("zoom", "3");
      url.searchParams.append("x", onlineUser.x.toString());
      url.searchParams.append("y", "64");
      url.searchParams.append("z", onlineUser.z.toString());
    }
    
    circle.classList.remove("offline");
    circle.setAttribute("href", url.toString());
    circle.setAttribute("target", "_blank");
    circle.setAttribute("rel", "noopener noreferrer");
    circle.classList.add("online");
    if (onlineUser.world === bogusWorld) {
      circle.textContent = "\u{1F310}"; // Globe with meridians
      circle.title = "Online in unknown world";
    } else {
      circle.textContent = "\u{1F30E}"; // Globe with Americas
      circle.title = "Online";
    }
  }
}

async function addOnlineIndicators() {
  addPlaceholders();

  await refreshOnlineIndicators();

  setInterval(async () => {
    try {
      refreshOnlineIndicators();
    } catch (e) {
      console.error(e);
    }
  }, 1000 * 30);
}

addOnlineIndicators();
