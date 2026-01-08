const yaml = require("js-yaml");
const fs = require("fs");
const Discord = require("discord.js");
const config = yaml.load(fs.readFileSync("./addons/StickyMessages/config.yml", "utf8"));
const StickyMessageModel = require("./StickyModel");
const VersionChecker = require('./VersionChecker');

// =========================================================================== 
// Version Checking & Startup Message 
// =========================================================================== 
const ADDON_NAME = 'Sticky Messages v2';
const CURRENT_VERSION = '1.0.1';
const DONATION_LINKS = [
    { name: 'PayPal', url: 'backupbrindisi@gmail.com' },
    { name: 'LTC', url: 'MUDCaPTBX6yjB1eNzFhsAphwV1ujN1eJ8V' }
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 
 * Checks for new updates and logs the result to the console. 
 */
async function runVersionCheck() {
    console.log('\x1b[33mChecking for updates...\x1b[0m');
    await delay(12000); // 12-second delay 

    const checker = new VersionChecker(ADDON_NAME, CURRENT_VERSION);
    const checkResult = await checker.checkForUpdates();

    console.log('\n\x1b[32m' + '='.repeat(60) + '\x1b[0m');

    if (checkResult.success) {
        if (checkResult.isOutdated) {
            console.log(`\x1b[1m🚨 \x1b[31mUPDATE AVAILABLE for ${ADDON_NAME}\x1b[0m 🚨`);
            console.log(`   \x1b[90mCurrent Version:\x1b[0m \x1b[1m${checkResult.current}\x1b[0m`);
            console.log(`   \x1b[90mLatest Version:\x1b[0m \x1b[1m\x1b[32m${checkResult.latest}\x1b[0m`);
            if (checkResult.description) {
                console.log(`   \x1b[90mChanges:\x1b[0m ${checkResult.description}`);
            }
            if (checkResult.urgent) {
                console.log('   \x1b[91m⚠️ URGENT UPDATE RECOMMENDED\x1b[0m');
            }
            if (checkResult.downloadUrl) {
                console.log(`   \x1b[90mDownload:\x1b[0m \x1b[4m${checkResult.downloadUrl}\x1b[0m`);
            }
        } else if (checkResult.isCurrent) {
            console.log(`\x1b[1m✅ \x1b[32m${ADDON_NAME} is up to date!\x1b[0m`);
            console.log(`   \x1b[90mVersion:\x1b[0m \x1b[1m${checkResult.current}\x1b[0m`);
        } else if (checkResult.isNewer) {
            console.log(`\x1b[1m🔧 \x1b[36mDevelopment version detected for ${ADDON_NAME}\x1b[0m`);
            console.log(`   \x1b[90mYour Version:\x1b[0m \x1b[1m${checkResult.current}\x1b[0m`);
            console.log(`   \x1b[90mLatest Public Version:\x1b[0m \x1b[1m${checkResult.latest}\x1b[0m`);
        }
    } else {
        console.log(`\x1b[1m❌ \x1b[33mVersion check failed for ${ADDON_NAME}\x1b[0m`);
        console.log(`   \x1b[90mReason:\x1b[0m ${checkResult.error}`);
    }
    console.log('\x1b[32m' + '='.repeat(60) + '\x1b[0m\n');
}

const cooldowns = new Map();

module.exports.register = ({ on, client }) => {
    if (!config.Enabled) return;

    /**
     * Displays a fancy startup message with addon information and donation links.
     */
    function displayStartupMessage() {
        const author = 'brindisicontroll.comeback';
        const donationText = DONATION_LINKS.map(link => `\x1b[96m${link.name}\x1b[0m: \x1b[4m${link.url}\x1b[0m`).join('\n');

        console.log('\n\x1b[32m' + '='.repeat(60) + '\x1b[0m');
        console.log(`\x1b[1m✨ \x1b[36m${ADDON_NAME}\x1b[0m is now active and running! \x1b[1m✨`);
        console.log(`   \x1b[90mVersion:\x1b[0m \x1b[1m${CURRENT_VERSION}\x1b[0m`);
        console.log(`   \x1b[90mCreated by:\x1b[0m \x1b[1m${author}\x1b[0m`);
        console.log('\n\x1b[93mEnjoying the addon? Consider supporting the developer:\x1b[0m');
        console.log(donationText);
        console.log('\x1b[32m' + '='.repeat(60) + '\x1b[0m\n');
    }

    // Display startup message and run initial version check
    (async () => {
        await runVersionCheck();
        displayStartupMessage();
    })();

    // Schedule daily version checks
    setInterval(runVersionCheck, 1000 * 60 * 60 * 24);

    const ensureWebhooks = async () => {
        try {
            const records = await StickyMessageModel.find({ useWebhook: true });
            for (const rec of records) {
                const channel = client.channels.cache.get(rec.channelId);
                if (!channel) continue;
                let needCreate = false;
                if (!rec.webhookId || !rec.webhookToken) {
                    needCreate = true;
                } else {
                    try {
                        const hooks = await channel.fetchWebhooks();
                        const exists = hooks.some(h => h.id === rec.webhookId);
                        if (!exists) needCreate = true;
                    } catch {
                        needCreate = true;
                    }
                }
                if (needCreate) {
                    const name = rec.webhookName || (config.Webhooks && config.Webhooks.Name) || "Sticky";
                    const avatarURL = rec.webhookAvatarURL || (config.Webhooks && config.Webhooks.AvatarURL) || null;
                    try {
                        const created = await channel.createWebhook({ name, avatar: avatarURL || undefined });
                        await StickyMessageModel.findByIdAndUpdate(rec._id, {
                            webhookId: created.id,
                            webhookToken: created.token,
                            webhookName: name,
                            webhookAvatarURL: avatarURL,
                        });
                    } catch {}
                }
            }
        } catch {}
    };

    if (config.Webhooks && config.Webhooks.CreateOnStartup) {
        ensureWebhooks();
    }
    if (config.Webhooks && config.Webhooks.CheckIntervalSeconds && config.Webhooks.CheckIntervalSeconds > 0) {
        setInterval(ensureWebhooks, config.Webhooks.CheckIntervalSeconds * 1000);
    }

    on("messageCreate", async (message) => {
        if (message.author.id === message.client.user.id || !message.guild) return;

        const stickyMessage = await StickyMessageModel.findOne({ channelId: message.channel.id });

        if (stickyMessage) {
            await StickyMessageModel.findByIdAndUpdate(stickyMessage._id, { $inc: { msgCount: 1 } });

            if (!cooldowns.has(message.channel.id) || cooldowns.get(message.channel.id) <= Date.now()) {
                cooldowns.set(message.channel.id, Date.now() + 1 * 1000);

                if (stickyMessage.msgCount >= config.MaxMessages) {
                    if (stickyMessage.messageId) {
                        const oldMsg = await message.channel.messages.fetch(stickyMessage.messageId).catch(() => null);
                        if (oldMsg) await oldMsg.delete().catch(() => {});
                    } else {
                        const messages = await message.channel.messages.fetch();
                        messages.forEach(async (msg) => {
                            if (
                                (!config.EnableEmbeds && msg.content && msg.content.includes(stickyMessage.message)) ||
                                (config.EnableEmbeds && msg.embeds && msg.embeds.some(embed => embed.description && embed.description.includes(stickyMessage.message)))
                            ) {
                                await msg.delete().catch(() => {});
                            }
                        });
                    }

                    const embed = new Discord.EmbedBuilder();
                    if (config.EmbedSettings.Embed.Title) embed.setTitle(config.EmbedSettings.Embed.Title);
                    embed.setDescription(stickyMessage.message);
                    if (config.EmbedSettings.Embed.Color) embed.setColor(config.EmbedSettings.Embed.Color);
                    if (config.EmbedSettings.Embed.Image) embed.setImage(config.EmbedSettings.Embed.PanelImage);
                    if (config.EmbedSettings.Embed.CustomThumbnailURL) embed.setThumbnail(config.EmbedSettings.Embed.CustomThumbnailURL);
                    if (config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text) {
                        embed.setFooter({ text: config.EmbedSettings.Embed.Footer.text });
                    }
                    if (config.EmbedSettings.Embed.Footer.CustomIconURL) {
                        embed.setFooter({ text: config.EmbedSettings.Embed.Footer.text, iconURL: config.EmbedSettings.Embed.Footer.CustomIconURL });
                    }
                    if (config.EmbedSettings.Embed.Timestamp) embed.setTimestamp();

                    let sentMessage;
                    if (stickyMessage.useWebhook && stickyMessage.webhookId && stickyMessage.webhookToken) {
                        try {
                            const hookClient = new Discord.WebhookClient({ id: stickyMessage.webhookId, token: stickyMessage.webhookToken });
                            if (config.EnableEmbeds) {
                                const res = await hookClient.send({ embeds: [embed] });
                                sentMessage = Array.isArray(res) ? res[0] : res;
                            } else {
                                const res = await hookClient.send({ content: `${config.StickiedMessageTitle}\n\n${stickyMessage.message}` });
                                sentMessage = Array.isArray(res) ? res[0] : res;
                            }
                        } catch {
                            if (config.EnableEmbeds) {
                                sentMessage = await message.channel.send({ embeds: [embed] });
                            } else {
                                sentMessage = await message.channel.send({ content: `${config.StickiedMessageTitle}\n\n${stickyMessage.message}` });
                            }
                        }
                    } else {
                        if (config.EnableEmbeds) {
                            sentMessage = await message.channel.send({ embeds: [embed] });
                        } else {
                            sentMessage = await message.channel.send({ content: `${config.StickiedMessageTitle}\n\n${stickyMessage.message}` });
                        }
                    }

                    await StickyMessageModel.findByIdAndUpdate(stickyMessage._id, { msgCount: 0, messageId: sentMessage.id });
                }
            } else {
                return;
            }
        }
    });
};
