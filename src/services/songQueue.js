const crypto = require("crypto");
const EventEmitter = require("events");

const MAX_CAPACITY = 10;

let queue = [];
const events = new EventEmitter();
const spotify = require("./spotifyService");

function sanitizeTitle(title) {
  if (typeof title !== "string") return "";
  return title.trim().slice(0, 200);
}

function addSong({ title, requestedBy }) {
  const cleanTitle = sanitizeTitle(title);
  if (!cleanTitle) {
    return { ok: false, error: "invalid_title" };
  }
  if (queue.length >= MAX_CAPACITY) {
    return { ok: false, error: "full" };
  }
  const item = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    requestedBy: requestedBy || "",
    requestedAt: Date.now(),
    matchStatus: "pending",
    spotify: null,
    matchError: null,
  };
  queue.push(item);
  events.emit("updated", getAll());

  // Async match with Spotify
  (async () => {
    try {
      const best = await spotify.searchBestTrack(cleanTitle);
      if (best) {
        // update in-place by id
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx >= 0) {
          queue[idx] = {
            ...queue[idx],
            matchStatus: "matched",
            spotify: best,
            matchError: null,
          };
          events.emit("updated", getAll());
        }
      } else {
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx >= 0) {
          queue[idx] = {
            ...queue[idx],
            matchStatus: "error",
            matchError: "no_match",
          };
          events.emit("updated", getAll());
        }
      }
    } catch (e) {
      const idx = queue.findIndex((q) => q.id === item.id);
      if (idx >= 0) {
        queue[idx] = {
          ...queue[idx],
          matchStatus: "error",
          matchError: "search_failed",
        };
        events.emit("updated", getAll());
      }
    }
  })();
  return { ok: true, item, position: queue.length };
}

function removeByIndex(index1Based) {
  const idx = Number(index1Based) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= queue.length) {
    return { ok: false, error: "not_found" };
  }
  const [removed] = queue.splice(idx, 1);
  events.emit("updated", getAll());
  return { ok: true, item: removed };
}

function skip() {
  if (queue.length === 0) {
    return { ok: false, error: "empty" };
  }
  const [removed] = queue.splice(0, 1);
  events.emit("updated", getAll());
  return { ok: true, item: removed };
}

function clear() {
  const count = queue.length;
  queue = [];
  events.emit("updated", getAll());
  return { ok: true, count };
}

function getAll() {
  return [...queue];
}

function size() {
  return queue.length;
}

function onUpdated(handler) {
  if (typeof handler === "function") {
    events.on("updated", handler);
  }
}

module.exports = {
  MAX_CAPACITY,
  addSong,
  removeByIndex,
  skip,
  clear,
  getAll,
  size,
  onUpdated,
};
