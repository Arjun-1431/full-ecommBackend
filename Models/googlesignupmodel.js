// Models/googlesignupmodel.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    image: { type: String },
    mobile: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false }, // Default to false
    role: { type: String } // Optionally include a role field
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

module.exports = User;
