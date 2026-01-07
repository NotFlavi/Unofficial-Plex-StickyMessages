const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml");
const StickyMessage = require('./StickyModel');
const config = yaml.load(fs.readFileSync('./addons/StickyMessages/config.yml', 'utf8'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage Sticky Messages')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a sticky message in this channel')
        .addStringOption(option => option.setName('msg').setDescription('Sticky message').setRequired(true))
        .addBooleanOption(option => option.setName('webhook').setDescription('Invia tramite Webhook').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('delete').setDescription('Delete the sticky message in this channel')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('list').setDescription('List all active sticky messages')
    ),
  async execute(interaction, client) {
    if (!interaction.member.permissions.has('ManageMessages'))
      return interaction.reply({ content: "You don't have permissions to use this command!", ephemeral: true });
    if (config.Enabled === false)
      return interaction.reply({ content: `This command has been disabled in the config!`, ephemeral: true });

    let subCmd = interaction.options.getSubcommand();

    if (subCmd === 'create') {
      if ((await StickyMessage.findOne({ channelId: interaction.channel.id })) !== null)
        return interaction.reply({
          content: `There is already a sticky message in this channel! Delete the old one before creating a new one`,
          ephemeral: true,
        });

      let msg = interaction.options.getString('msg');
      if (typeof msg === 'string') {
        msg = msg.replace(/\\n/g, '\n');
      }
      let useWebhookOpt = interaction.options.getBoolean('webhook');
      let useWebhook = typeof useWebhookOpt === 'boolean' ? useWebhookOpt : !!(config.Webhooks && config.Webhooks.EnabledByDefault);
      if (useWebhook && !interaction.member.permissions.has('ManageWebhooks')) {
        return interaction.reply({ content: `You need Manage Webhooks permission to create sticky via webhook.`, ephemeral: true });
      }

        const embed = new Discord.EmbedBuilder()
        if(config.EmbedSettings.Embed.Title) embed.setTitle(config.EmbedSettings.Embed.Title)
        embed.setDescription(msg)
        if(config.EmbedSettings.Embed.Color) embed.setColor(config.EmbedSettings.Embed.Color)
        if(config.EmbedSettings.Embed.Image) embed.setImage(config.EmbedSettings.Embed.PanelImage)
        if(config.EmbedSettings.Embed.CustomThumbnailURL) embed.setThumbnail(config.EmbedSettings.Embed.CustomThumbnailURL)
        if(config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text) embed.setFooter({ text: `${config.EmbedSettings.Embed.Footer.text}` })
        if(config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text && config.EmbedSettings.Embed.Footer.CustomIconURL) embed.setFooter({ text: `${config.EmbedSettings.Embed.Footer.text}`, iconURL: `${config.EmbedSettings.Embed.Footer.CustomIconURL}` })
        if(config.EmbedSettings.Embed.Timestamp) embed.setTimestamp()

      let sentMessage = null;
      let webhookData = { webhookId: null, webhookToken: null, webhookName: null, webhookAvatarURL: null };
      if (useWebhook) {
        const webhookName = config.Webhooks && config.Webhooks.Name ? config.Webhooks.Name : 'Sticky';
        const avatarURL = config.Webhooks && config.Webhooks.AvatarURL ? config.Webhooks.AvatarURL : null;
        const createdHook = await interaction.channel.createWebhook({
          name: webhookName,
          avatar: avatarURL || undefined,
        });
        try {
          const hookClient = new Discord.WebhookClient({ id: createdHook.id, token: createdHook.token });
          if(config.EnableEmbeds === true) {
            sentMessage = await hookClient.send({ embeds: [embed] });
          } else {
            sentMessage = await hookClient.send({ content: `${config.StickiedMessageTitle}\n\n${msg}` });
          }
          webhookData = { webhookId: createdHook.id, webhookToken: createdHook.token, webhookName, webhookAvatarURL: avatarURL };
        } catch (e) {
          useWebhook = false;
        }
      }
      if (!sentMessage) {
        if(config.EnableEmbeds === false) sentMessage = await interaction.channel.send(`${config.StickiedMessageTitle}\n\n${msg}`)
        if(config.EnableEmbeds === true) sentMessage = await interaction.channel.send({ embeds: [embed] })
      }

      await StickyMessage.create({
        channelId: interaction.channel.id,
        message: msg,
        msgCount: 0,
        messageId: sentMessage?.id || null,
        useWebhook,
        webhookId: webhookData.webhookId,
        webhookToken: webhookData.webhookToken,
        webhookName: webhookData.webhookName,
        webhookAvatarURL: webhookData.webhookAvatarURL,
      });

      interaction.reply({ content: `You have successfully set a sticky message in this channel!`, ephemeral: true });

      if (config.EnableSlowmode) interaction.channel.setRateLimitPerUser(config.SlowmodeDelay);
    } else if (subCmd === 'delete') {
      const stickyMessage = await StickyMessage.findOne({ channelId: interaction.channel.id });

      if (!stickyMessage)
        return interaction.reply({ content: `There is no sticky message in this channel!`, ephemeral: true });

        await StickyMessage.findOneAndDelete({ channelId: interaction.channel.id });

      if (stickyMessage.messageId) {
        try {
          const oldMsg = await interaction.channel.messages.fetch(stickyMessage.messageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch {}
      } else {
        await interaction.channel.messages.fetch().then(async (msgs) => {
          await msgs.forEach(async (msg) => {
            if (msg.content && msg.content.includes(stickyMessage.message)) {
              await msg.delete().catch((e) => {});
            }
          });
        });
      }

      if (config.EnableSlowmode) interaction.channel.setRateLimitPerUser('0');

      interaction.reply({
        content: `You have successfully deleted the sticky message from this channel!`,
        ephemeral: true,
      });
    } else if (subCmd === 'list') {
        const allStickyMessages = await StickyMessage.find();
  
        if (allStickyMessages.length === 0) {
          return interaction.reply({ content: 'There are no active sticky messages.', ephemeral: true });
        }
  
        const embed = new Discord.EmbedBuilder()
          .setTitle('Active Sticky Messages')
          .setColor('Green');
  
        for (const stickyMessage of allStickyMessages) {
          const channel = client.channels.cache.get(stickyMessage.channelId);
  
          if (channel) {
            embed.addFields(
              { name: 'Channel', value: channel.name, inline: true },
              { name: 'Message', value: stickyMessage.message, inline: true },
              { name: 'Webhook', value: stickyMessage.useWebhook ? 'Yes' : 'No', inline: true },
            );
          } else {
            await StickyMessage.findOneAndDelete({ channelId: stickyMessage.channelId });
          }
        }
  
        interaction.reply({ embeds: [embed], ephemeral: true });
      }
    },
  };
