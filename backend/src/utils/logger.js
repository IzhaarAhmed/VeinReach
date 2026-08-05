/* Minimal leveled logger. Swap for pino/winston later without touching callers. */
const ts = () => new Date().toISOString();

const write = (level, args) => {
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`${ts()} [${level.toUpperCase()}]`, ...args);
};

export const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') write('debug', args);
  },
};
