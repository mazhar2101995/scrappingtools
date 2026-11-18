module.exports = {
  apps: [
    {
      name: 'saas-api',
      script: './apps/api/dist/main.js',
      instances: 1, // Single instance for cron scheduler or cluster with distributed Redis lock
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'saas-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start apps/dashboard -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
