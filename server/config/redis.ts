import IORedis from 'ioredis';

export class RedisConnectionFactory {
  private static client: IORedis | null = null;

  public static createClient(): IORedis {
    if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      const client = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });
      client.on('error', (err) => {
        // Suppress unhandled connection errors
      });
      return client;
    }

    // Return dummy client if in local mock environment
    const client = new IORedis({
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });
    client.on('error', () => {
      // Suppress unhandled connection errors in test environment
    });
    return client;
  }
}

export function getRedisConnection(): IORedis {
  return RedisConnectionFactory.createClient();
}
