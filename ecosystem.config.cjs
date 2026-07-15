/**
 * PM2 ecosystem — Unique NGO Dashboard (VPS)
 *
 * Paths assume:
 *   /var/www/rndprojects/UNIQUE_NGO_DASHBOARD/{backend,frontend}
 *
 * Ports (chosen to avoid common conflicts 3000/3001/5173/8080):
 *   API (NestJS) → 3017
 *   Frontend     → static files via nginx (no Node port)
 */
module.exports = {
  apps: [
    {
      name: 'unique-ngo-api',
      cwd: '/var/www/rndprojects/UNIQUE_NGO_DASHBOARD/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3017,
      },
      error_file: '/var/log/pm2/unique-ngo-api-error.log',
      out_file: '/var/log/pm2/unique-ngo-api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
