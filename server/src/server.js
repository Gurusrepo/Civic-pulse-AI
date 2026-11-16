import { env } from './config/env.js';
import { db, closeDatabase } from './config/database.js';
import { migrateDatabase } from './database/migrate.js';

async function startServer() {
  try {
    migrateDatabase(db);
  } catch (error) {
    console.error('Database schema initialization failed:', error.message);
    closeDatabase();
    process.exitCode = 1;
    return;
  }

  let app;
  try {
    ({ default: app } = await import('./app.js'));
  } catch (error) {
    console.error('Application loading failed:', error.message);
    closeDatabase();
    process.exitCode = 1;
    return;
  }

  const { startAssessmentWorker } = await import('./modules/intelligence/intelligence.worker.js');
  const stopAssessmentWorker = startAssessmentWorker();

  const server = app.listen(env.PORT, () => {
    console.log(`CivicPulse API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  function shutdown() {
    stopAssessmentWorker();
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

await startServer();
