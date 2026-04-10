import { run } from './task-runner';

run().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
