import Bowser from 'bowser'
import Settings from '@overleaf/settings'
import Url from 'node:url'
import UrlHelper from '../Features/Helpers/UrlHelper.mjs'

const { getSafeRedirectPath } = UrlHelper

// Common link preview / social crawlers not always detected by Bowser
const LINK_PREVIEW_BOT_PATTERNS = [
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /Slackbot/i,
  /Discordbot/i,
  /TelegramBot/i,
  /applebot/i,
  /Googlebot/i,
  /bingbot/i,
  /Baiduspider/i,
  /Pinterest/i,
  /Embedly/i,
  /Iframely/i,
  /Preview/i,  // Catches many preview bots
]

function isLinkPreviewBot(userAgent) {
  return LINK_PREVIEW_BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

function unsupportedBrowserMiddleware(req, res, next) {
  if (!Settings.unsupportedBrowsers) return next()

  // Prevent redirect loop
  const path = req.path
  if (path === '/unsupported-browser') return next()

  const userAgent = req.headers['user-agent']

  if (!userAgent) return next()

  // Allow known link preview bots (iMessage, social media, etc.)
  if (isLinkPreviewBot(userAgent)) return next()

  const parser = Bowser.getParser(userAgent)

  // Allow bots through by only ignoring bots or unrecognised UA strings
  const isBot = parser.isPlatform('bot') || !parser.getBrowserName()
  if (isBot) return next()

  const isUnsupported = parser.satisfies(Settings.unsupportedBrowsers)
  if (isUnsupported) {
    return res.redirect(
      Url.format({
        pathname: '/unsupported-browser',
        query: { fromURL: req.originalUrl },
      })
    )
  }

  next()
}

function renderUnsupportedBrowserPage(req, res) {
  let fromURL
  if (typeof req.query.fromURL === 'string') {
    try {
      fromURL =
        Settings.siteUrl + (getSafeRedirectPath(req.query.fromURL) || '/')
    } catch (e) {}
  }
  res.render('general/unsupported-browser', { fromURL })
}

export default {
  renderUnsupportedBrowserPage,
  unsupportedBrowserMiddleware,
}
