const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    mobileno: String,
    isAdmin: { type: Boolean, default: false },
    personId: String,
    imageq: String
});

module.exports = mongoose.model('registerwithoutgoogle', userSchema);
