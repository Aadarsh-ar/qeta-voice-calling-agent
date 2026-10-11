module.exports = {
  apps: [
    {
      name: "qeta-web",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "logs/web-error.log",
      out_file: "logs/web-out.log",
      time: true,
    },
    {
      name: "qeta-voice-agent",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "src/agent/worker.ts start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/agent-error.log",
      out_file: "logs/agent-out.log",
      time: true,
    },
  ],
};
