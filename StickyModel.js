const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    msgCount: { type: Number, default: 0 },
    messageId: { type: String, default: null },
    useWebhook: { type: Boolean, default: false },
    webhookId: { type: String, default: null },
    webhookToken: { type: String, default: null },
    webhookName: { type: String, default: null },
    webhookAvatarURL: { type: String, default: null },
  });

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);
