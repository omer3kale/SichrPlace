/**
 * Compatibility wrapper.
 * Some scripts and deployment configs expect the backend entrypoint at `backend/server.js`.
 * The real implementation currently lives at `js/backend/server.js`.
 * This wrapper simply requires and re-exports the Express app so existing scripts work.
 */

// Ensure we don't accidentally start a duplicate listener; the real server file
// only calls listen when NODE_ENV !== 'test'. This wrapper does not modify NODE_ENV.

// eslint-disable-next-line global-require
const app = require('../js/backend/server.js');

module.exports = app;
