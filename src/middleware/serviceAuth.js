const crypto = require('crypto');

// Bearer-token guard for server-to-server callers.
// Fails closed: if FRAME9_SERVICE_TOKEN is not configured, every request is rejected with 503.
function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function requireServiceToken({ getToken = () => process.env.FRAME9_SERVICE_TOKEN } = {}) {
  return function serviceAuth(req, res, next) {
    const expected = getToken();
    if (!expected) {
      return res.status(503).json({ ok: false, error: 'Service token not configured' });
    }

    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Hash both sides so timingSafeEqual always compares equal-length buffers
    // and the token length is not leaked through timing.
    if (!crypto.timingSafeEqual(sha256(match[1].trim()), sha256(expected))) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    return next();
  };
}

module.exports = { requireServiceToken };
