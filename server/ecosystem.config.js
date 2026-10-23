module.exports = {
  apps: [
    {
      name: 'chart-reader',
      script: 'server.js',
      cwd: __dirname,
      env: {
        PORT: '8081',
        FIREBASE_PROJECT_ID: 'chart-reader-45c13',
        TRUST_PROXY: '1',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '', // set it in the server's environment, never in this file
      },
    },
  ],
};