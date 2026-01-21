module.exports = {
  apps : [{
    name: "AgartPOS",
    script: "npx",
    args: "tsx server/index.ts",
    interpreter: "none",
    env: {
      NODE_ENV: "development",
    }
  }]
}