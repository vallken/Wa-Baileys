// Load environment variables and dependencies
require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const Admin = require("./lib/db/admin");
const logger = require("./utils/logger");
const { checkAndExecuteAlias } = require("./plugin/alias");
const config = require("./config");
const { isPluginInMaintenance } = require("./plugin/mt");
const { handleMessage } = require("./plugin/quiz");

// Override console methods with logger
console.log = (...args) => logger.info(args.length > 1 ? args : args[0]);
console.info = (...args) => logger.info(args.length > 1 ? args : args[0]);
console.warn = (...args) => logger.warn(args.length > 1 ? args : args[0]);
console.error = (...args) => logger.error(args.length > 1 ? args : args[0]);

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize client state
const client = {
  commands: new Map(),
};

let connectionStatus = "disconnected";
let processedMessages = 0;

// Database connection
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("Could not connect to MongoDB:", err);
    process.exit(1);
  }
}

// Plugin management
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

// Message handling
const debounce = (func, delay) => {
  let inDebounce;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(inDebounce);
    inDebounce = setTimeout(() => func.apply(context, args), delay);
  };
};

async function handleCommand(sock, msg, messageContent) {
  const args = messageContent.slice(1).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const userId = msg.key.participant ? msg.key.participant : msg.key.remoteJid;

  logger.debug({ command, args });

  if (!client.commands.has(command)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `Command not found. Type ${config.prefix[1]}help to get a list of all commands`,
    });
    return;
  }
  const admin = await Admin.findOne({ userId });
  const commandHandler = client.commands.get(command);
  const isInMaintenance = await isPluginInMaintenance(command);

  if (isInMaintenance) {
    if (!admin || userId !== admin.userId) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Plugin '${command}' sedang dalam maintenance. Coba lagi nanti!`,
      });
    }
    return;
  }
  if (commandHandler.commandType === "Admin") {
    if (!admin || userId !== admin.userId) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "You don't have permission to use this command",
      });
      return;
    }
  }
  logger.info(`Command executed by ${userId}`);

  try {
    await sock.sendPresenceUpdate("composing", msg.key.remoteJid);
    await sock.readMessages([msg.key]);
    await commandHandler.execute(sock, msg, args);
  } catch (error) {
    logger.error("Error executing command:", error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "An error occurred while processing the command",
    });
  }
}

const processCommand = debounce(handleCommand, 1000);

// WhatsApp connection handling
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  // Connection event handler
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

      // Initialize scheduled tasks
      require("./plugin/ingatkansholat").initializeSchedules(sock);
      require("./plugin/remind").initializeSchedules(sock);
    }
  });

  // Message event handler
  let isProcessingCommand = false;
  sock.ev.on("messages.upsert", async (m) => {
    if (isProcessingCommand) return;

    const msg = m.messages[0];
    if (msg.key.fromMe) return;

    await require("./plugin/afk").checkAfkMention(sock, msg);
    await require("./plugin/afk").checkAfkMessage(sock, msg);

    const messageContent = extractMessageContent(msg);

    if (!messageContent) return;


    if (config.prefix.some((p) => messageContent.startsWith(p))) {
      isProcessingCommand = true;
      try {
        await processCommand(sock, msg, messageContent);
      } finally {
        isProcessingCommand = false;
      }
      return;
    }
    const quizExecuted = await handleMessage(sock, msg);
    if (quizExecuted) {
      processedMessages++;
    }

    const aliasExecuted = await checkAndExecuteAlias(sock, msg, messageContent);
    if (aliasExecuted) {
      processedMessages++;
    }
  });

  sock.ev.on("creds.update", saveCreds);
}


// Helper function to extract message content
function extractMessageContent(msg) {
  if (!msg.message) return null;

  if (msg.message.conversation) {
    return msg.message.conversation;
  }
  if (msg.message.extendedTextMessage) {
    return msg.message.extendedTextMessage.text;
  }
  if (msg.message.imageMessage) {
    return msg.message.imageMessage.caption;
  }
  if (msg.message.videoMessage) {
    return msg.message.videoMessage.caption;
  }
  return null;
}

// Express routes
app.get("/", (req, res) => {
  res.send("Baileys Bot is running");
});

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
    processedMessages: processedMessages,
    loadedPlugins: Array.from(client.commands.keys()),
    commandsLoaded: client.commands.size,
  });
});

// Main application startup
async function main() {
  try {
    await connectToDatabase();
    await loadPlugins();
    connectToWhatsApp();

    app.listen(port, () => {
      logger.info(`Server is listening on port ${port}`);
    });
  } catch (error) {
    logger.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
