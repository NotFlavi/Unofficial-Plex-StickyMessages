[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/D8M226BS99)

# Unofficial Plex StickyMessages

This is a modified version of StickyMessages made by `brindisicontroll.comeback`, originally sent by `Swqpping` on 20/08/2025. This is not an official release.

## 🚀 Main Features

*   **Persistent Sticky Messages**: The bot monitors the chat and automatically resends the sticky message after a configurable number of new messages.
*   **Webhook Support**: Ability to send sticky messages using Webhooks, allowing customization of the sender's name and avatar (e.g., to look like a system announcement).
*   **Embed & Plain Text Support**: Total flexibility in choosing the message format. You can use rich embeds or simple text messages.
*   **Automatic Slowmode**: Option to automatically enable slowmode in the channel where a sticky message is active, useful for controlling chat flow.
*   **Slash Command Management**: Simple and intuitive interface to create, delete, and view sticky messages directly from Discord.
*   **Advanced Configuration**: Customize colors, titles, images, footers, and behaviors via the `config.yml` file.

## 🛠️ Configuration (`config.yml`)

The `config.yml` file is the heart of the addon's customization. Here are the main options:

*   **General**:
    *   `Enabled`: Globally enables or disables the addon.
    *   `MaxMessages`: Defines how many user messages pass before the bot reposts the sticky message.
    *   `EnableSlowmode` & `SlowmodeDelay`: Settings to manage automatic slowmode in sticky channels.

*   **Appearance (EmbedSettings)**:
    *   Customize `Title`, `Color`, `Image`, `Thumbnail`, and `Footer` for Embed messages.

*   **Webhooks**:
    *   `EnabledByDefault`: Sets whether to use webhooks as the default sending method.
    *   `Name` & `AvatarURL`: Default name and image for webhooks created by the bot.

## 💻 Slash Commands

The addon uses the main command `/sticky` for all operations:

### `/sticky create`
Sets a new sticky message in the channel where the command is typed.
*   **Options**:
    *   `msg` (Required): The message text. Use `\n` for line breaks.
    *   `webhook` (Optional): `True` to send via webhook, `False` to use the standard bot.
    *   `embed` (Optional): `True` to use an embed, `False` for plain text.
    *   `count` (Optional): Custom message count interval. If not set, the default from `config.yml` is used.

### `/sticky delete`
Removes the active sticky message in the current channel and stops the resending cycle.

### `/sticky list`
Displays a complete list of all active sticky messages across all channels, showing details like type (Embed/Text) and whether it uses Webhooks.

## 📋 Technical Requirements
*   **Discord Permissions**: The bot requires `Manage Messages` permissions and, if using the webhook feature, `Manage Webhooks`.
*   **Dependencies**:
    *   `discord.js`: To interact with the Discord API.
    *   `mongoose`: For MongoDB object modeling.
    *   `js-yaml`: To parse the configuration file.
    *   `node-fetch`: For making HTTP requests (used internally).
    *   `@discordjs/builders`: For building slash commands.

## 📦 Installation and Startup

1.  Configure your preferences in the `config.yml` file.
2.  Ensure dependencies are installed.
3.  Start the bot. The addon will automatically load the configurations.

## Technical Changes
- Version checks run daily with safe error handling
- Config-driven cooldown reduces unnecessary processing in busy channels
- Cleanup is limited when messageId is missing (scan up to 100 recent messages; supports text and embeds)
- Unified embed footer setup with optional iconURL
- EmbedSettings.Embed.Image is used consistently for embed images
- Numeric slowmode “off” using 0
- `/sticky create`: validates `count` (min 1) and uses `deferReply`/`editReply` to avoid timeouts
- `/sticky list`: truncates long message previews (~200 chars)
- Default fallback `MaxMessages = 10` when not set
