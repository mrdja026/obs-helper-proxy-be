const SpotifyWebApi = require("spotify-web-api-node");
const config = require("../config/config");
const logger = require("../utils/logger");
const fileStore = require("./spotifyFileTokenStorage");

function createClient(accessToken, refreshToken) {
  const client = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    redirectUri: config.spotify.redirectUri,
  });
  if (accessToken) client.setAccessToken(accessToken);
  if (refreshToken) client.setRefreshToken(refreshToken);
  return client;
}

async function ensureAccessToken() {
  const tokens = await fileStore.getTokens();
  if (!tokens) throw new Error("spotify_not_authenticated");
  const client = createClient(tokens.accessToken, tokens.refreshToken);
  // refresh if expired (best-effort)
  if (new Date() >= new Date(tokens.expiresAt)) {
    try {
      // PKCE-compatible refresh: do NOT use client secret
      const { default: fetch } = await import("node-fetch");
      const params = new URLSearchParams();
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", tokens.refreshToken);
      params.set("client_id", config.spotify.clientId);

      const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`spotify_refresh_failed ${resp.status} ${text}`);
      }

      const body = await resp.json();
      const accessToken = body.access_token;
      const expiresIn = body.expires_in;
      const newRefreshToken = body.refresh_token || tokens.refreshToken;

      await fileStore.storeTokens(
        {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn,
          scope: tokens.scope,
          tokenType: body.token_type || tokens.tokenType,
        },
        tokens.user
      );

      return createClient(accessToken, newRefreshToken);
    } catch (e) {
      logger.error("Spotify refresh failed", { error: e.message });
      throw new Error("spotify_refresh_failed");
    }
  }
  return client;
}

async function searchBestTrack(title) {
  const client = await ensureAccessToken();
  try {
    const res = await client.searchTracks(title, { limit: 5 });
    const items = res?.body?.tracks?.items || [];
    if (!items.length) return null;
    const best = items[0];
    const artists = Array.isArray(best.artists)
      ? best.artists.map((a) => a.name)
      : [];
    const name = best.name || title;
    const candidate = {
      id: best.id,
      uri: best.uri,
      name,
      artists,
      confidence: 0.8,
    };
    return candidate;
  } catch (e) {
    logger.error("Spotify search failed", { error: e.message });
    return null;
  }
}

async function getPlaybackState() {
  const client = await ensureAccessToken();
  try {
    const res = await client.getMyCurrentPlaybackState();
    return res?.body || null;
  } catch (e) {
    logger.error("Spotify getPlaybackState failed", { error: e.message });
    return null;
  }
}

async function addToPlaybackQueue(uri) {
  const client = await ensureAccessToken();
  try {
    await client.addToQueue(uri);
    return true;
  } catch (e) {
    logger.error("Spotify addToQueue failed", { error: e.message });
    throw e;
  }
}

async function getPlaybackSnapshot() {
  const client = await ensureAccessToken();
  try {
    const [playRes, devicesRes] = await Promise.all([
      client.getMyCurrentPlaybackState(),
      client.getMyDevices(),
    ]);

    const playback = playRes?.body || null;
    const devices = Array.isArray(devicesRes?.body?.devices)
      ? devicesRes.body.devices
      : [];

    const maskId = (id) =>
      typeof id === "string" && id.length > 8
        ? id.slice(0, 4) + "…" + id.slice(-4)
        : id || null;

    const safePlayback = playback
      ? {
          isPlaying: !!playback.is_playing,
          progressMs:
            typeof playback.progress_ms === "number"
              ? playback.progress_ms
              : null,
          item: playback.item
            ? {
                name: playback.item.name || null,
                uri: playback.item.uri || null,
                artists: Array.isArray(playback.item.artists)
                  ? playback.item.artists.map((a) => a.name)
                  : [],
                durationMs:
                  typeof playback.item.duration_ms === "number"
                    ? playback.item.duration_ms
                    : null,
              }
            : null,
          device: playback.device
            ? {
                name: playback.device.name || null,
                id: maskId(playback.device.id),
                is_active: !!playback.device.is_active,
                type: playback.device.type || null,
              }
            : null,
        }
      : null;

    const safeDevices = devices.map((d) => ({
      name: d?.name || null,
      id: maskId(d?.id),
      is_active: !!d?.is_active,
      type: d?.type || null,
    }));

    return {
      playback: safePlayback,
      devices: safeDevices,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    logger.error("Spotify debug snapshot failed", { error: e.message });
    throw e;
  }
}

async function exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
  // PKCE: exchange via token endpoint with clientId + code_verifier
  // spotify-web-api-node doesn't expose PKCE exchange directly; use fetch
  const { default: fetch } = await import("node-fetch");
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  const chosenRedirect = redirectUri || config.spotify.redirectUri;
  // Validate redirectUri against allowlist if provided
  if (redirectUri) {
    const allowed = (config.spotify.allowedRedirectUris || []).includes(
      redirectUri
    );
    if (!allowed) {
      throw new Error("invalid_redirect_uri");
    }
  }
  params.set("redirect_uri", chosenRedirect);
  params.set("client_id", config.spotify.clientId);
  params.set("code_verifier", codeVerifier);
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`spotify_exchange_failed ${resp.status} ${text}`);
  }
  const body = await resp.json();
  // store
  await fileStore.storeTokens(
    {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      scope: (body.scope || "").split(" ").filter(Boolean),
      tokenType: body.token_type,
    },
    null
  );
}

module.exports = {
  ensureAccessToken,
  searchBestTrack,
  getPlaybackState,
  addToPlaybackQueue,
  exchangeCodeForTokens,
  getPlaybackSnapshot,
};
