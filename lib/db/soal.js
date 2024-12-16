const mongoose = require('mongoose');

const soalScheme = mongoose.Schema({
    soal: {
        type: String,
        required: true,
        unique: true
    },
    jawaban: {
        type: String,
        required: true
    },
    isUsed: { 
        type: Boolean,
        default: false
    },
})

const Soal = mongoose.model('soal', soalScheme)

module.exports = Soal