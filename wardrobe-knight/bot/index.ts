import { app } from './app.js';

const port = Number(process.env.PORT ?? 3000);

await app.start(port);
console.log(`:shield: Wardrobe Knight bot is running on port ${port}`);
