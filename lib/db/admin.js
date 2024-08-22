const mongoose = require('mongoose')

const AdminSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    }
}, {collection: 'admin'})

const Admin = mongoose.model('admin', AdminSchema)

module.exports = Admin