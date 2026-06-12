import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
app.listen(env.port, () => {
  console.log(`StreamHub backend chạy tại http://localhost:${env.port}`);
});
