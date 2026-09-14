'use strict';

const {wrap} = require('./lib/admin-session-proxy.js');
const handler = require('./kk-admin-snapshot-v6.js');

module.exports = wrap(handler);
