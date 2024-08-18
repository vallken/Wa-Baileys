const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const apiKey = "AIzaSyBI_Hk7k7svdd7lFWMch2qf0K_1expH5Lw";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function execute(sock, msg, args) {
  const chatSession = model.startChat({
    generationConfig,
    // safetySettings: Adjust safety settings
    // See https://ai.google.dev/gemini-api/docs/safety-settings
    history: [],
  });

  const result = await chatSession.sendMessage(args.join(" "));
  sock.sendMessage(msg.key.remoteJid, { text: result.response.text() });
}

module.exports = {
  name: "Gemini AI",
  description: "Chat with Gemini AI",
  command: "!chat",
  commandType: "Info",
  isDependent: false,
  help: "Just Chatting.",
  execute,
};
