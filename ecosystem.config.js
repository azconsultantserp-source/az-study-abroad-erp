// PM2 process manager — an alternative to Docker for running the app directly
// on the VPS (Node 20). Provides clustering, auto-restart, and graceful reload.
//
//   npm ci && npm run build
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup   # survive reboots
//
// Zero-downtime deploy:  pm2 reload az-erp
module.exports = {
  apps: [
    {
      name: "az-erp",
      // Run the Next.js standalone server produced by `next build`.
      script: ".next/standalone/server.js",
      instances: process.env.WEB_CONCURRENCY || 2,
      exec_mode: "cluster",
      max_memory_restart: "512M",
      kill_timeout: 10000, // allow in-flight requests to drain
      listen_timeout: 8000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
