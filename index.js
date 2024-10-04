const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const afkPlugin = require("./plugin/afk");
const jadwalPlugin = require("./plugin/ingatkansholat");
const agendaPlugin = require("./plugin/remind");
const express = require("express");
const mongoose = require("mongoose");
const Admin = require("./lib/db/admin");

require("dotenv").config();
global.prefix = [",", "!"];


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB:", err));

const app = express();
const port = process.env.PORT || 3000;
const client = {
  commands: new Map(),
};

// Load plugins
const pluginDir = path.join(__dirname, "plugin");
fs.readdir(pluginDir, (err, files) => {
  if (err) return console.error("Error reading plugin directory:", err);
  files.forEach((commandFile) => {
    if (commandFile.endsWith(".js")) {
      const commandName = commandFile.replace(".js", "");
      const commandPath = path.join(pluginDir, commandFile);
      try {
        const command = require(commandPath);
        client.commands.set(commandName, command);
        console.log(`Loaded plugin: ${commandName}`);
      } catch (error) {
        console.error(`Error loading plugin ${commandName}:`, error);
      }
    }
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
      console.log(
        "Connection closed due to ",
        lastDisconnect.error,
        ", reconnecting ",
        shouldReconnect
      );
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Connected to WhatsApp");
      jadwalPlugin.initializeSchedules(sock);
      agendaPlugin.initializeSchedules(sock);
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

    console.log({ command, args });
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
          console.log(`Command executed by ${userId}`);
        }
      }
      try {
        await sock.sendPresenceUpdate("composing", msg.key.remoteJid);
        await sock.readMessages([msg.key]);
        await client.commands.get(command).execute(sock, msg, args);
      } catch (error) {
        console.error("Error executing command:", error);
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
    await afkPlugin.checkAfkMention(sock, msg);
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

// Run in main file
connectToWhatsApp();

app.get("/", (req, res) => {
  res.send("Baileys Bot is running");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
