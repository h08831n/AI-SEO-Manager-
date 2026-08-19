export type AppMode = 'PRODUCTION' | 'DEVELOPMENT' | 'DEMO' | 'TEST';

export function getAppMode(): AppMode {
  if (process.env.APP_MODE) {
    const mode = process.env.APP_MODE.toUpperCase();
    if (['PRODUCTION', 'DEVELOPMENT', 'DEMO', 'TEST'].includes(mode)) {
      return mode as AppMode;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return 'PRODUCTION';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'TEST';
  }
  return 'DEVELOPMENT';
}

export function isProductionMode(): boolean {
  return getAppMode() === 'PRODUCTION';
}

export function isDatabaseRequired(): boolean {
  return isProductionMode();
}
