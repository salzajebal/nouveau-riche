module.exports = {
  apps: [
    {
      name: "npay-app",
      script: "dist/index.cjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};