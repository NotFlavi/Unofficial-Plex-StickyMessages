const yaml = require("js-yaml");
const fs = require("fs");
const Discord = require("discord.js");
const config = yaml.load(fs.readFileSync("./addons/StickyMessages/config.yml", "utf8"));
const StickyMessageModel = require("./StickyModel");

const cooldowns = new Map();

module.exports.register = ({ on, client }) => {
    if (!config.Enabled) return;

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
