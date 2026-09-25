# Community Bot

Configurable multi-server Discord community bot built with Discord.js, Firebase Firestore, and Express.

## Features

- Slash commands and configurable prefix commands
- Warning system
- Moderation
- AFK
- No-prefix users
- ModMail
- Temporary voice channels
- Miscellaneous utilities
- Active Time tracking
- Components V2 UI with configurable server branding

## Requirements

- Node.js 22+
- A Discord bot application
- A Firebase project with Firestore enabled
- A GitHub repository
- A Render account
- Optional: UptimeRobot account for external uptime monitoring

## Discord Bot Setup

1. Open the Discord Developer Portal and create an application.
2. Open **Bot** and create/reset the bot token.
3. Enable these privileged intents:
   - **Message Content Intent**
   - **Server Members Intent**
   - **Presence Intent**
4. Under **OAuth2 > URL Generator**, select:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions required by the features you enable. For full functionality, the bot will need permissions such as Send Messages, View Channels, Manage Messages, Manage Channels, Manage Roles, Kick Members, Ban Members, Moderate Members, Move Members, Mute Members, Deafen Members, and Manage Webhooks where applicable.
5. Invite the bot to your server.

## Firebase / Firestore Setup

### 1. Create the project

1. Open the Firebase Console.
2. Create a Firebase project.
3. Open **Build > Firestore Database**.
4. Create the Firestore database.

### 2. Create the service account

1. Open **Project settings > Service accounts**.
2. Select **Firebase Admin SDK**.
3. Click **Generate new private key**.
4. Download the JSON file.
5. Keep this JSON private. Do not commit it to GitHub or post it publicly.

### 3. Create FIREBASE_KEY

The bot expects the entire service-account JSON as a single environment variable.

If you are running locally, put the JSON into `.env` as a single-line JSON value:

```env
FIREBASE_KEY={"type":"service_account",...}
```

The private key contains escaped newlines such as \\n. Keep the JSON valid.

You can also use the downloaded JSON to copy its complete contents into the environment variable. Do not add extra quotes around the whole value unless your environment platform requires them.

## Local Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/twirlyowes/community-bot.git
cd community-bot
npm install
```

Create a `.env` file:

```env
DISCORD_TOKEN=your_discord_bot_token
FIREBASE_KEY={"type":"service_account",...}
PORT=10000
```

Start the bot:

```bash
npm start
```

You should see messages indicating that the bot logged in, registered slash commands, and started the health server.

The health endpoints are:

- `/` — basic online response
- `/health` — JSON health status

## Render Deployment

### 1. Create the Web Service

1. Open Render.
2. Create **New > Web Service**.
3. Connect your GitHub account.
4. Select `twirlyowes/community-bot`.
5. Use these settings:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Node Version | 22 or newer |
| Port | `10000` |

Render can use the repository's Node engine requirement. If Render asks for a Node version explicitly, use Node 22+.

### 2. Add Environment Variables

In **Render > Service > Environment**, add:

```env
DISCORD_TOKEN=your_discord_bot_token
FIREBASE_KEY={"type":"service_account",...}
PORT=10000
```

Do not commit `.env` or the Firebase service-account JSON to GitHub.

### 3. Deploy

Click **Create Web Service** / **Deploy**.

After deployment, check the Render logs. A healthy startup should show the bot logging in, slash commands registering, configuration initialization, and the HTTP health server listening.

Open:

```
https://YOUR-RENDER-SERVICE.onrender.com/health
```

A healthy response looks similar to:

```json
{"ok":true,"bot":true,"guilds":1}
```

The exact guild count depends on how many servers the bot is in.

## UptimeRobot

UptimeRobot can monitor the bot's Render health endpoint and alert you if the web service stops responding.

1. Create an account on UptimeRobot.
2. Create a new monitor.
3. Choose **HTTP(s)**.
4. Use your Render health URL:

```
https://YOUR-RENDER-SERVICE.onrender.com/health
```

5. Set a reasonable monitoring interval available on your UptimeRobot plan.
6. Save the monitor.

Use the `/health` endpoint rather than the Discord gateway itself. UptimeRobot checks the HTTP server; it does not directly verify that Discord commands are working.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `FIREBASE_KEY` | Yes | Firebase Admin SDK service-account JSON |
| `PORT` | No | HTTP port; defaults to `10000` |

## Configuration

Server configuration is stored in Firestore under:

```
guilds/{guildId}/settings/config
```

The bot supports configurable:

- Command prefix
- Bot display name
- Staff role
- Moderation log channel
- Active Time settings
- Temporary voice-channel settings

Use `/config` where supported to manage server settings.

## Important Security Notes

- Never commit `.env` files.
- Never commit the Firebase service-account JSON.
- Never share your Discord bot token.
- If a token or private key is exposed, rotate/revoke it immediately.
- Give the Discord bot only the permissions it actually needs.
- Keep Firebase credentials server-side only.

## Updating the Bot

Push changes to the `main` branch. Render can automatically redeploy the service when automatic deploys are enabled.

For local changes:

```bash
git add .
git commit -m "Update bot"
git push origin main
```

## Troubleshooting

### Bot is offline

Check:

- `DISCORD_TOKEN` exists in Render.
- The token is valid and has not been regenerated.
- The bot has been invited to the server.
- Render logs for startup errors.

### Firebase errors

Check:

- Firestore is enabled.
- `FIREBASE_KEY` contains valid service-account JSON.
- The complete private key is present.
- The environment variable was saved correctly.

### Prefix commands do not work

Check:

- Message Content Intent is enabled in the Discord Developer Portal.
- The bot has permission to read and send messages.
- The command uses the configured prefix.

### Active Time is not tracking

Check:

- Presence Intent is enabled.
- The relevant Active Time configuration is set for the server.
- The bot can see the members it is expected to track.

### Render health check fails

Check:

- The service is running.
- Render logs show the Express health server started.
- `PORT` is set to `10000` if required by the service configuration.
- You are opening the correct `/health` URL.

## License

Use and modify this bot for your own Discord community.