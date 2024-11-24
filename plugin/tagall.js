const config = require('../config'); 


const execute = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  if (chatId.endsWith('@s.whatsapp.net')) {
    await sock.sendMessage(msg.key.remoteJid, { 
        text: 'This command can only be used in groups!' 
    }, {
        quoted: msg
    });
    return;
}

  try {
    const groupMetaData = await sock.groupMetadata(chatId);
    const participants = groupMetaData.participants
    const botId = sock.user.id.replace(/:\d+(?=@)/, "");
    const participantsWithoutBot = participants
        .filter(p => p.id !== botId)
        .map(p => p.id)
    
    if (!participants || participants.length === 0) {
      await sock.sendMessage(chatId, {
        text: "No participants found in the group.",
      });
      return;
    }

    let mentionText = "Hey everyone! ";
    let mentions = [];
    
    participantsWithoutBot.forEach((participantId) => {
      mentionText += `@${participantId.split("@")[0]} `;
      mentions.push(participantId);
    });
    console.log(mentions)

    await sock.sendMessage(chatId, {
      text: mentionText,
      mentions: mentions,
    });
  } catch (error) {
    console.error("Error:", error);
    await sock.sendMessage(chatId, { text: "Failed to tag all members." });
  }
};

module.exports = {
  name: "broadcast",
  description: "Broadcast message to all participants in a group",
  command: `${config.prefix[1]}tagall`,
  commandType: "Utility",
  isDependent: false,
  execute,
};
