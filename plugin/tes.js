const config = require("../config");

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  const msgId = sock.profilePictureUrl(from, "image");
  sock.sendMessage(from, { image: { url: await msgId } });
  const waitMsg = await sock.waitForMessage(msg, 6000);
  console.log(await waitMsg);
};

module.exports = {
  name: "tes",
  description: "Ping Pong",
  command: `${config.prefix[1]}ping`,
  commandType: "Utility",
  isDependent: false,
  help: ``,
  execute,
};
