const { translate } = require("bing-translate-api");
const he = require("he");
const {decodeHTML} = require("entities")

async function translateApi(text, bahasa = "id") {
  try {
    const translateSegments = async (text) => {
      const segments = text.split(/(\{[^}]*\})/g);

      const translatedSegments = await Promise.all(
        segments.map(async (segment, index) => {
          if (index % 2 === 1) return segment;
          const decodedSegment = segment.replace(/&[a-zA-Z0-9#]+;/g, (match) =>
            he.decode(match)
          );
          const translation = await translate(decodedSegment, null, bahasa);
          return translation?.translation || segment;
        })
      );

      return translatedSegments.join("");
    };

    return await translateSegments(text);
  } catch (error) {
    console.error("Translation Bing error:", error);
    return "";
  }
}

module.exports = translateApi;
