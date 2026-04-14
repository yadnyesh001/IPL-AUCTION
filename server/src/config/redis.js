const log = require('../utils/logger');

// In-memory fallback that implements the subset of ioredis we use.
class MemoryRedis {
  constructor() { this.store = new Map(); this.subs = new Map(); }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v, ...args) {
    this.store.set(k, v);
    // naive EX handling
    const exIdx = args.indexOf('EX');
    if (exIdx !== -1) {
      const ttl = Number(args[exIdx + 1]) * 1000;
      setTimeout(() => this.store.delete(k), ttl).unref?.();
    }
    return 'OK';
  }
  async del(k) { return this.store.delete(k) ? 1 : 0; }
  async publish(channel, msg) {
    const subs = this.subs.get(channel) || [];
    subs.forEach(fn => { try { fn(channel, msg); } catch {} });
    return subs.length;
  }
  async subscribe(channel) {
    if (!this.subs.has(channel)) this.subs.set(channel, []);
    return 1;
  }
  on(event, fn) {
    if (event === 'message') {
      // attach fn to every future subscription
      this._messageHandler = fn;
      for (const [ch, arr] of this.subs) arr.push(fn);
    }
  }
  duplicate() { return this; }
  async quit() { this.store.clear(); this.subs.clear(); }
}

let client = null;
let pub = null;
let sub = null;

async function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    log.warn('REDIS_URL not set — using in-memory fallback (not suitable for multi-instance).');
    client = new MemoryRedis();
    pub = client;
    sub = client;
    return client;
  }
  try {
    const Redis = require('ioredis');
    const opts = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
      family: 4, // force IPv4 — avoids Windows IPv6 hangs with Upstash
      retryStrategy: (times) => {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 500, 3000);
      },
    };
    // rediss:// → enable TLS (Upstash requires it)
    if (url.startsWith('rediss://')) opts.tls = {};

    client = new Redis(url, opts);
    pub = new Redis(url, opts);
    sub = new Redis(url, opts);
    for (const c of [client, pub, sub]) {
      c.on('error', e => log.error('Redis error:', e.message));
    }
    // Wait for the first ready event so we can fall back cleanly on failure
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('redis connect timeout')), 10000);
      client.once('ready', () => { clearTimeout(t); resolve(); });
      client.once('end', () => { clearTimeout(t); reject(new Error('redis connection ended')); });
    });
    log.info('Redis connected');
    return client;
  } catch (e) {
    log.error('Redis init failed, falling back to memory:', e.message);
    client = new MemoryRedis();
    pub = client; sub = client;
    return client;
  }
}

const getClient = () => client;
const getPub = () => pub;
const getSub = () => sub;

module.exports = { initRedis, getClient, getPub, getSub };
