import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB. Mongoose buffers commands until connected, but we await
 * an explicit connection so startup fails loudly if the DB is unreachable.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err));
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
