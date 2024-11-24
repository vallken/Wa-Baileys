const config = require('../config'); // Import konfigurasi prefix


const execute = async(sock, msg, args) => {
    const chatId = msg.key.remoteJid
    
    try {
        const groupMetaData = await sock.groupMetadata(chatId)
        
        if (chatId.endsWith('@s.whatsapp.net')) {
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'This command can only be used in groups!' 
            }, {
                quoted: msg
            });
            return;
        }
        const participants = groupMetaData.participants
        const botId = sock.user.id.replace(/:\d+(?=@)/, "");
        const participantsWithoutBot = participants
            .filter(p => p.id !== botId)
            .map(p => p.id)
        
        if (!participantsWithoutBot || participantsWithoutBot.length === 0) {
            await sock.sendMessage(chatId, { text: 'No participants found in the group.' });
            return;
        }

        let messageText = args.join(' ') || 'Hey everyone!'
        
        await sock.sendMessage(chatId, {
            text: messageText,
            mentions: participantsWithoutBot
        });
        
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { text: 'Failed to hidetag members.' });
    }
}

module.exports = {
    name: "hidetag",
    description: "Mention all members without visible tags",
    command: `${config.prefix[1]}hidetag`,
    commandType: "Utility", 
    isDependent: false,
    execute
}