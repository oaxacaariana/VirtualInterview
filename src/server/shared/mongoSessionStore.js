/**
 * Mongo-backed Express session store.
 * Inputs: Mongo connection details plus Express session store callbacks and session payloads.
 * Outputs: Session persistence operations for get, set, touch, destroy, and cleanup.
 */
const session = require('express-session');
const { MongoClient } = require('mongodb');

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

class MongoSessionStore extends session.Store {
  constructor({
    uri,
    dbName,
    collectionName = 'sessions',
    ttlMs = DEFAULT_TTL_MS,
  }) {
    super();
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.ttlMs = ttlMs;
    this.client = null;
    this.collection = null;
    this.readyPromise = null;
  }

  async ensureReady() {
    if (this.collection) {
      return this.collection;
    }

    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        this.client = new MongoClient(this.uri);
        await this.client.connect();
        const db = this.client.db(this.dbName);
        this.collection = db.collection(this.collectionName);
        await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return this.collection;
      })();
    }

    return this.readyPromise;
  }

  getExpiration(sessionData) {
    const cookieExpires = sessionData?.cookie?.expires;
    if (cookieExpires) {
      return new Date(cookieExpires);
    }

    const maxAge = Number(sessionData?.cookie?.maxAge);
    if (Number.isFinite(maxAge) && maxAge > 0) {
      return new Date(Date.now() + maxAge);
    }

    return new Date(Date.now() + this.ttlMs);
  }

  async get(sid, callback) {
    try {
      const collection = await this.ensureReady();
      const sessionDoc = await collection.findOne({
        _id: sid,
        $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }],
      });

      callback(null, sessionDoc?.session || null);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const collection = await this.ensureReady();
      await collection.updateOne(
        { _id: sid },
        {
          $set: {
            session: sessionData,
            expiresAt: this.getExpiration(sessionData),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      const collection = await this.ensureReady();
      await collection.updateOne(
        { _id: sid },
        {
          $set: {
            expiresAt: this.getExpiration(sessionData),
            updatedAt: new Date(),
          },
        }
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async destroy(sid, callback) {
    try {
      const collection = await this.ensureReady();
      await collection.deleteOne({ _id: sid });
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.collection = null;
      this.readyPromise = null;
    }
  }
}

module.exports = { MongoSessionStore };
