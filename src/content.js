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

  for (const world of worlds) {
    const url = new URL("https://tildes.nore.gg/standalone/MySQL_update.php");
    url.searchParams.append("world", world);
    url.searchParams.append("ts", Date.now());

    const response = await fetch(url);

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

async function addOnlineIndicators() {
  const tildesUsers = await getAllWorlds();
  
  for (const link of document.querySelectorAll("a.link-user")) {
    const onlineUser = tildesUsers.find(user => user.name === link.textContent);
    if (!onlineUser) {
      continue;
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
    
    const circle = document.createElement("a");
    circle.setAttribute("href", url.toString());
    circle.setAttribute("target", "_blank");
    circle.classList.add("mc-online-indicator");
    if (onlineUser.world === bogusWorld) {
      circle.textContent = "🌐";
      circle.title = "Online in unknown world";
    } else {
      circle.textContent = "🌎";
      circle.title = "Online";
    }

    // Put circle after the link tag
    link.after(circle);
  }
}

addOnlineIndicators();
