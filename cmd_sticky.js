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
        .addIntegerOption(option => option.setName('count').setDescription('Messages count interval (default: config value)').setRequired(false))
        .addBooleanOption(option => option.setName('webhook').setDescription('Invia tramite Webhook').setRequired(false))
        .addBooleanOption(option => option.setName('embed').setDescription('Invia come embed (True) o testo (False)').setRequired(false))
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
      await interaction.deferReply({ ephemeral: true });
      if ((await StickyMessage.findOne({ channelId: interaction.channel.id })) !== null)
        return interaction.editReply({
          content: `There is already a sticky message in this channel! Delete the old one before creating a new one`,
          ephemeral: true,
        });

      let msg = interaction.options.getString('msg');
      let count = interaction.options.getInteger('count');
      if (typeof count === 'number') {
        if (!Number.isFinite(count) || count < 1) count = 1;
      }

      if (typeof msg === 'string') {
        msg = msg.replace(/\\n/g, '\n');
      }
      let useWebhookOpt = interaction.options.getBoolean('webhook');
      let useWebhook = typeof useWebhookOpt === 'boolean' ? useWebhookOpt : !!(config.Webhooks && config.Webhooks.EnabledByDefault);

      let useEmbedOpt = interaction.options.getBoolean('embed');
      let useEmbed = typeof useEmbedOpt === 'boolean' ? useEmbedOpt : (config.EnableEmbeds !== undefined ? config.EnableEmbeds : true);

      if (useWebhook && !interaction.member.permissions.has('ManageWebhooks')) {
        return interaction.reply({ content: `You need Manage Webhooks permission to create sticky via webhook.`, ephemeral: true });
      }

        const embed = new Discord.EmbedBuilder();
        if (config.EmbedSettings.Embed.Title) embed.setTitle(config.EmbedSettings.Embed.Title);
        embed.setDescription(msg);
        if (config.EmbedSettings.Embed.Color) embed.setColor(config.EmbedSettings.Embed.Color);
        if (config.EmbedSettings.Embed.Image) embed.setImage(config.EmbedSettings.Embed.Image);
        if (config.EmbedSettings.Embed.CustomThumbnailURL) embed.setThumbnail(config.EmbedSettings.Embed.CustomThumbnailURL);
        if (config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text) {
          const footer = { text: `${config.EmbedSettings.Embed.Footer.text}` };
          if (config.EmbedSettings.Embed.Footer.CustomIconURL) footer.iconURL = `${config.EmbedSettings.Embed.Footer.CustomIconURL}`;
          embed.setFooter(footer);
        }
        if (config.EmbedSettings.Embed.Timestamp) embed.setTimestamp();

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
          if(useEmbed === true) {
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
        if(useEmbed === false) sentMessage = await interaction.channel.send(`${config.StickiedMessageTitle}\n\n${msg}`)
        if(useEmbed === true) sentMessage = await interaction.channel.send({ embeds: [embed] })
      }

      await StickyMessage.create({
        channelId: interaction.channel.id,
        message: msg,
        msgCount: 0,
        customMaxMessages: count,
        messageId: sentMessage?.id || null,
        useWebhook,
        useEmbed,
        webhookId: webhookData.webhookId,
        webhookToken: webhookData.webhookToken,
        webhookName: webhookData.webhookName,
        webhookAvatarURL: webhookData.webhookAvatarURL,
      });

      await interaction.editReply({ content: `You have successfully set a sticky message in this channel!`, ephemeral: true });

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
        const msgs = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (msgs) {
          for (const msg of msgs.values()) {
            const hasText = msg.content && msg.content.includes(stickyMessage.message);
            const hasEmbed = msg.embeds && msg.embeds.some(e => e.description && e.description.includes(stickyMessage.message));
            if (hasText || hasEmbed) {
              await msg.delete().catch(() => {});
            }
          }
        }
      }

      if (config.EnableSlowmode) interaction.channel.setRateLimitPerUser(0);

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
            const preview = typeof stickyMessage.message === 'string' && stickyMessage.message.length > 200 ? (stickyMessage.message.slice(0, 197) + '...') : stickyMessage.message;
            embed.addFields(
              { name: 'Channel', value: channel.name, inline: true },
              { name: 'Message', value: preview || '-', inline: true },
              { name: 'Webhook', value: stickyMessage.useWebhook ? 'Yes' : 'No', inline: true },
              { name: 'Type', value: stickyMessage.useEmbed ? 'Embed' : 'Text', inline: true },
            );
          } else {
            await StickyMessage.findOneAndDelete({ channelId: stickyMessage.channelId });
          }
        }
  
        interaction.reply({ embeds: [embed], ephemeral: true });
      }
    },
  };
