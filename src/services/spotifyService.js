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
      const data = await client.refreshAccessToken();
      const accessToken = data.body["access_token"];
      const expiresIn = data.body["expires_in"];
      client.setAccessToken(accessToken);
      await fileStore.storeTokens(
        {
          accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn,
          scope: tokens.scope,
          tokenType: tokens.tokenType,
        },
        tokens.user
      );
      return createClient(accessToken, tokens.refreshToken);
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

async function exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
  // PKCE: exchange via token endpoint with clientId + code_verifier
  // spotify-web-api-node doesn't expose PKCE exchange directly; use fetch
  const fetch = require("node-fetch");
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
};
