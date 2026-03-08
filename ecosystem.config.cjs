const path = require('path');
const appDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'onboarding-agent',
      script: 'src/api/server.js',
      cwd: appDir,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Auto-restart
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 2000,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(appDir, 'logs/pm2-error.log'),
      out_file: path.join(appDir, 'logs/pm2-out.log'),
      merge_logs: true,
      log_type: 'json',

      // Memory guard — restart if it eats too much RAM
      max_memory_restart: '500M',

      // Graceful shutdown
      kill_timeout: 15000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
