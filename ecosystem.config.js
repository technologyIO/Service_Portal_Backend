module.exports = {
  apps: [{
    name: 'service-backend',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096',
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium-browser'
    }
  }]
};