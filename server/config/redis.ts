import IORedis from 'ioredis';

export class RedisConnectionFactory {
  private static client: IORedis | null = null;

  public static createClient(): IORedis {
    if (process.env.REDIS_URL) {
      return new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }

    // Return dummy client if in local mock environment
    return new IORedis({
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
}

export function getRedisConnection(): IORedis {
  return RedisConnectionFactory.createClient();
}
