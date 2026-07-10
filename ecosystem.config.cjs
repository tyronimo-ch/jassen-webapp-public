// pm2 process definitions for the Jassen server + web.
// Run from the repo root:  pm2 start ecosystem.config.cjs

const path = require('path');
// Automatically load variables from your Next.js app's secret .env file
require('dotenv').config({ path: path.resolve(__dirname, 'apps/web/.env') });

// Fallback to a placeholder string if the .env file isn't present (e.g., in the public repo)
const CLIENT_ORIGIN = process.env.NEXT_PUBLIC_SERVER_NAME 
  ? `https://${process.env.NEXT_PUBLIC_SERVER_NAME}` 
  : "https://jassen.example.com";

const SERVER_PORT = process.env.NEXT_PUBLIC_SERVER_PORT || "4000";
const WEB_PORT = process.env.NEXT_PUBLIC_WEB_PORT || "3000";

module.exports = {
  apps: [
    {
      name: "jassen-server",
      cwd: __dirname,
      script: "npm",
      args: "run start:prod --workspace apps/server",
      // PM2 injects these into process.env for your Express/Socket.io backend
      env: { 
        PORT: SERVER_PORT, 
        CLIENT_ORIGIN: CLIENT_ORIGIN 
      },
    },
    {
      name: "jassen-web",
      cwd: __dirname,
      script: "npm",
      args: "run start --workspace apps/web",
      // PM2 injects this into process.env for your Next.js production build
      env: { 
        PORT: WEB_PORT 
      },
    },
  ],
};