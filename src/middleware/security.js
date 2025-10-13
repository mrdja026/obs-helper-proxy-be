const helmet = require("helmet");

/**
 * Security headers middleware
 *
 * Notes:
 * - Twitch OAuth and Helix calls require allowing Twitch domains in CSP connectSrc.
 * - Some frontend environments/extensions (e.g., Grammarly) may attempt to inject scripts.
 *   We explicitly allow 'moz-extension:' in scriptSrc to avoid noisy console errors on pages
 *   that receive our headers (especially during redirects). This does not weaken API security
 *   because our API does not serve active HTML pages; it returns JSON/redirects.
 * - styleSrc/imgSrc include 'unsafe-inline' and data: to avoid blocking common UI libraries
 *   if any HTML were ever returned. If you strictly serve JSON only, this is low risk.
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Allow backend websocket, Twitch OAuth/Helix, and CDN domains
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://id.twitch.tv",
        "https://api.twitch.tv",
        "https://static.twitchcdn.net",
      ],
      // Allow inline scripts and extensions to avoid noisy errors on redirects,
      // and Twitch static CDN if ever used by OAuth pages.
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://static.twitchcdn.net",
        "moz-extension:",
      ],
      // Allow inline styles commonly used by UI libs (if served) and fonts/images via data:
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: [
        "'self'",
        "data:",
        "https://static-cdn.jtvnw.net",
        "https://static.twitchcdn.net",
      ],
      // Keep frames locked down; we are not embedded anywhere.
      frameAncestors: ["'none'"],
    },
  },
  // Some OAuth flows and third-party integrations can break with COEP/COEP; relax for APIs
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

module.exports = {
  securityHeaders,
};
