// Small structured logger: JSON lines in production (so hosts like Render can
// parse/aggregate them) and readable text in development. Avoids a heavy logging
// dependency while giving us levels + structured metadata.

const isProduction = process.env.NODE_ENV === 'production';

type Level = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, unknown>;

function emit(level: Level, message: string, meta?: Meta) {
  const entry = { level, time: new Date().toISOString(), message, ...(meta || {}) };
  const line = isProduction
    ? JSON.stringify(entry)
    : `${entry.time} ${level.toUpperCase().padEnd(5)} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => { if (!isProduction) emit('debug', message, meta); },
  info: (message: string, meta?: Meta) => emit('info', message, meta),
  warn: (message: string, meta?: Meta) => emit('warn', message, meta),
  error: (message: string, meta?: Meta) => emit('error', message, meta),
};
