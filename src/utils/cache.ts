import { config } from "../config.js";
import { stringify, parse } from "flatted";
import logger from "./logger.js";
import NodeCache from "node-cache";
import Redis from "ioredis";

interface CacheData {
  updateTime: string;
  data: unknown;
}

// init NodeCache (作为降级缓存)
const nodeCache = new NodeCache({
  stdTTL: config.CACHE_TTL,
  checkperiod: 600,
  useClones: false,
  maxKeys: 100,
});

// Redis 客户端和状态标志
let redis: Redis;
let useRedis: boolean = false; // 明确标志是否使用Redis

const MAX_REDIS_CONNECTION_ATTEMPTS = 5;
let redisConnectionAttempts: number = 0;

// 初始化Redis连接
const initRedis = () => {
  redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times >= MAX_REDIS_CONNECTION_ATTEMPTS) {
        logger.warn(`📦 [Redis] Maximum connection attempts (${MAX_REDIS_CONNECTION_ATTEMPTS}) reached. Falling back to NodeCache.`);
        useRedis = false; // 达到最大尝试次数，降级
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      logger.info(`📦 [Redis] Retrying connection in ${delay}ms (attempt ${times + 1}/${MAX_REDIS_CONNECTION_ATTEMPTS})`);
      return delay;
    },
    connectTimeout: 5000,
    commandTimeout: 3000,
  });

  redis.on("error", (err: Error) => {
    useRedis = false; // 发生错误，触发降级
    logger.error(`📦 [Redis] Error: ${err.message}. Falling back to NodeCache.`);
  });

  redis.on("close", () => {
    useRedis = false;
    logger.info("📦 [Redis] Connection closed. Using NodeCache.");
  });

  redis.on("ready", () => {
    useRedis = true;
    redisConnectionAttempts = 0;
    logger.info("📦 [Redis] Connected successfully. Using Redis.");
  });

  redis.on("end", () => {
    useRedis = false;
    logger.info("📦 [Redis] Connection ended. Using NodeCache.");
  });
};

// 立即初始化Redis
initRedis();

// NodeCache 事件监听（可选）
nodeCache.on("expired", (key) => {
  logger.debug(`⏳ [NodeCache] Key "${key}" has expired.`);
});

nodeCache.on("del", (key) => {
  logger.debug(`🗑️ [NodeCache] Key "${key}" has been deleted.`);
});

/**
 * 从缓存中获取数据
 * @param key 缓存键
 * @returns 缓存数据
 */
export const getCache = async (key: string): Promise<CacheData | undefined> => {
  // 1. 优先尝试从 Redis 获取
  if (useRedis) {
    try {
      const redisResult = await redis.get(key);
      if (redisResult) {
        logger.info(`💾 [Redis] Cache hit for key: ${key}`);
        return parse(redisResult) as CacheData;
      } else {
        logger.info(`💾 [Redis] Cache miss for key: ${key}`);
        // Redis中不存在，也返回undefined，不再检查NodeCache
        return undefined;
      }
    } catch (error) {
      useRedis = false; // 获取失败，触发降级
      logger.error(`📦 [Redis] Get error, falling back to NodeCache for key: ${key}.`, error);
      // 降级逻辑：继续尝试从 NodeCache 获取
    }
  }

  // 2. Redis不可用或失败，降级到 NodeCache
  const nodeCacheResult = nodeCache.get(key);
  if (nodeCacheResult) {
    logger.info(`💾 [NodeCache] Cache hit for key: ${key}`);
    return nodeCacheResult as CacheData;
  } else {
    logger.info(`💾 [NodeCache] Cache miss for key: ${key}`);
    return undefined;
  }
};

/**
 * 将数据写入缓存
 * @param key 缓存键
 * @param value 缓存值
 * @param ttl 缓存过期时间（ 秒 ）
 * @returns 是否写入成功
 */
export const setCache = async (
  key: string,
  value: CacheData,
  ttl: number = config.CACHE_TTL,
): Promise<boolean> => {
  let success = false;

  // 1. 优先尝试写入 Redis
  if (useRedis && !Buffer.isBuffer(value?.data)) {
    try {
      await redis.set(key, stringify(value), "EX", ttl);
      logger.info(`💾 [Redis] Cache set for key: ${key}`);
      success = true;
      // Redis写入成功，不需要再写入NodeCache，避免冗余
      return success;
    } catch (error) {
      useRedis = false; // 写入失败，触发降级
      logger.error(`📦 [Redis] Set error, falling back to NodeCache for key: ${key}.`, error);
      // 降级逻辑：继续尝试写入 NodeCache
    }
  }

  // 2. Redis不可用或失败，降级到 NodeCache
  success = nodeCache.set(key, value, ttl);
  if (success) {
    logger.info(`💾 [NodeCache] Cache set for key: ${key}`);
  } else {
    logger.error(`💾 [NodeCache] Failed to set cache for key: ${key}`);
  }
  return success;
};

/**
 * 从缓存中删除数据
 * @param key 缓存键
 * @returns 是否删除成功
 */
export const delCache = async (key: string): Promise<boolean> => {
  let success = false;

  // 1. 优先尝试从 Redis 删除
  if (useRedis) {
    try {
      await redis.del(key);
      logger.info(`🗑️ [Redis] ${key} has been deleted`);
      success = true;
      // Redis删除成功，不需要再删除NodeCache（因为可能不存在）
      return success;
    } catch (error) {
      useRedis = false; // 删除失败，触发降级
      logger.error(`📦 [Redis] Del error, falling back to NodeCache for key: ${key}.`, error);
      // 降级逻辑：继续尝试从 NodeCache 删除
    }
  }

  // 2. Redis不可用或失败，降级到 NodeCache
  const deletedCount = nodeCache.del(key);
  success = deletedCount > 0;
  if (success) {
    logger.info(`🗑️ [NodeCache] ${key} has been deleted`);
  }
  return success;
};