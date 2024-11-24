const config = require('../config'); 

const execute = async (sock, msg, args) => {
  const moment = (await import("moment")).default;
  const timestamp = Math.floor(Date.now() / 1000) - 300;
  const calculatePing = function (timestamp, now) {
    return moment.duration(now - moment(timestamp * 1000)).asSeconds();
  };
  sock.sendMessage(
    msg.key.remoteJid,
    {
      text: `*Ping :* *_${calculatePing(timestamp, Date.now())} second(s)_*`,
    },
    { quoted: msg }
  );
};

module.exports = {
  name: "ping",
  description: "Ping Pong Command",
  command: `${config.prefix[1]}ping`,
  commandType: "Utility",
  isDependent: false,
  execute,
};
