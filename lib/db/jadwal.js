const mongoose = require("mongoose");

const jadwalSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    kota: { type: String, required: true },
    lokasi: {type: String, required: true},
    jadwal: {
      imsak: String,
      subuh: String,
      dhuha: String,
      dzuhur: String,
      ashar: String,
      maghrib: String,
      isya: String,
    },
    timestamp: { type: Date, default: Date.now },
  },
  {
    collection: "jadwal",
  }
);

const Jadwal = mongoose.model("jadwal", jadwalSchema);

module.exports = Jadwal;
