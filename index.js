const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const afkPlugin = require("./plugin/afk")
const jadwalPlugin = require('./plugin/ingatkansholat')
const express = require('express')
const mongoose = require("mongoose");

require("dotenv").config();

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
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    await afkPlugin.checkAfkMention(sock, msg);
    if (msg.key.fromMe) return; // Ignore self-messages
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
      if (messageContent.startsWith(",")) {
        await sock.sendPresenceUpdate("composing", msg.key.remoteJid);
        await sock.readMessages([msg.key]);

        const args = messageContent.slice(1).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        console.log({ command, args });

        if (client.commands.has(command)) {
          try {
            await client.commands.get(command).execute(sock, msg, args, m);
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
