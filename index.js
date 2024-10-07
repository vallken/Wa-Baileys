require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const Admin = require("./lib/db/admin");
const logger = require('./utils/logger');

global.prefix = [",", "!", ".", "?"];
console.log = (...args) => logger.info(args.length > 1 ? args : args[0]);
console.info = (...args) => logger.info(args.length > 1 ? args : args[0]);
console.warn = (...args) => logger.warn(args.length > 1 ? args : args[0]);
console.error = (...args) => logger.error(args.length > 1 ? args : args[0]);


const app = express();
const port = process.env.PORT || 3000;
const client = {
  commands: new Map(),
};

let connectionStatus = "disconnected";
let processedMessages = 0;
const loadedPlugins = [];

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("Could not connect to MongoDB:", err);
    process.exit(1);
  }
}

async function loadPlugins() {
  const pluginDir = path.join(__dirname, "plugin");
  try {
    const files = await fs.readdir(pluginDir);
    for (const commandFile of files) {
      if (commandFile.endsWith(".js")) {
        const commandName = commandFile.replace(".js", "");
        const commandPath = path.join(pluginDir, commandFile);
        try {
          const command = require(commandPath);
          client.commands.set(commandName, command);
          loadedPlugins.push(commandName);
          logger.info(`Loaded plugin: ${commandName}`);
        } catch (error) {
          logger.error(`Error loading plugin ${commandName}:`, error);
        }
      }
    }
  } catch (err) {
    logger.error("Error reading plugin directory:", err);
  }
}

client.commands.set('reload', {
  commandType: "Admin",
  execute: async (sock, msg, args) => {
    const pluginName = args[0];
    const commandPath = path.join(__dirname, "plugin", `${pluginName}.js`);
    
    if (client.commands.has(pluginName)) {
      delete require.cache[require.resolve(commandPath)];
      try {
        const newCommand = require(commandPath);
        client.commands.set(pluginName, newCommand);
        await sock.sendMessage(msg.key.remoteJid, { text: `Plugin ${pluginName} berhasil di-reload` });
        logger.info(`Plugin ${pluginName} reloaded`);
      } catch (error) {
        logger.error(`Error reloading plugin ${pluginName}:`, error);
        await sock.sendMessage(msg.key.remoteJid, { text: `Gagal reload plugin ${pluginName}: ${error.message}` });
      }
    } else {
      await sock.sendMessage(msg.key.remoteJid, { text: `Plugin ${pluginName} tidak ditemukan` });
    }
  }
});

async function watchPlugins() {
  const pluginDir = path.join(__dirname, "plugin");
  fs.watch(pluginDir, (eventType, filename) => {
    if ((eventType === 'change' || eventType === 'rename') && filename.endsWith('.js')) {
      const pluginName = filename.replace(".js", "");
      const commandPath = path.join(pluginDir, filename);

      if (client.commands.has(pluginName)) {
        delete require.cache[require.resolve(commandPath)];
        try {
          const newCommand = require(commandPath);
          client.commands.set(pluginName, newCommand);
          logger.info(`Plugin ${pluginName} reloaded automatically`);
        } catch (error) {
          logger.error(`Error reloading plugin ${pluginName}:`, error);
        }
      }
    }
  });
}

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
    processedMessages: processedMessages,
    loadedPlugins: Array.from(client.commands.keys()),
    commandsLoaded: client.commands.size
  });
});

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error instanceof Boom &&
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      logger.info(
        "Connection closed due to ",
        lastDisconnect.error,
        ", reconnecting ",
        shouldReconnect
      );
      connectionStatus = "disconnected";
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      logger.info("Connected to WhatsApp");
      connectionStatus = "connected";
      require("./plugin/ingatkansholat").initializeSchedules(sock);
      require("./plugin/remind").initializeSchedules(sock);
    }
  });

  const debounce = (func, delay) => {
    let inDebounce;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(inDebounce);
      inDebounce = setTimeout(() => func.apply(context, args), delay);
    };
  };

  const processCommand = debounce(async (sock, msg, messageContent) => {
    const args = messageContent.slice(1).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    logger.debug({ command, args });
    const userId = msg.key.participant
      ? msg.key.participant
      : msg.key.remoteJid;

    if (client.commands.has(command)) {
      if (client.commands.get(command).commandType === "Admin") {
        const admin = await Admin.findOne({ userId });
        if (!admin || userId !== admin.userId) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "You don't have permission to use this command",
          });
          return;
        } else {
          logger.info(`Command executed by ${userId}`);
        }
      }
      try {
        await sock.sendPresenceUpdate("composing", msg.key.remoteJid);
        await sock.readMessages([msg.key]);
        await client.commands.get(command).execute(sock, msg, args);
      } catch (error) {
        logger.error("Error executing command:", error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "An error occurred while processing the command",
        });
      }
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Command not found. Type .help to get a list of all commands",
      });
    }
  }, 1000);

  let isProcessingCommand = false;
  sock.ev.on("messages.upsert", async (m) => {
    if (isProcessingCommand) return;
    const msg = m.messages[0];
    await require("./plugin/afk").checkAfkMention(sock, msg);
    if (msg.key.fromMe) return;

    let messageContent = "";
    if (msg.message) {
      if (msg.message.conversation) {
        messageContent = msg.message.conversation;
      } else if (msg.message.extendedTextMessage) {
        messageContent = msg.message.extendedTextMessage.text;
      } else if (msg.message.imageMessage) {
        messageContent = msg.message.imageMessage.caption;
      } else if (msg.message.videoMessage) {
        messageContent = msg.message.videoMessage.caption;
      }
      if (global.prefix.some((p) => messageContent.startsWith(p))) {
        isProcessingCommand = true;
        try {
          await processCommand(sock, msg, messageContent);
        } finally {
          isProcessingCommand = false;
        }
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

async function main() {
  await connectToDatabase();
  await loadPlugins();
  await watchPlugins();
  connectToWhatsApp();

  app.get("/", (req, res) => {
    res.send("Baileys Bot is running");
  });

  app.listen(port, () => {
    logger.info(`Server is listening on port ${port}`);
  });
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});