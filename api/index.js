/**
 * api/index.js — Vercel Serverless Function entry point
 * Wraps the Express app so Vercel can invoke it as a serverless handler.
 */
module.exports = require('../backend/server');
