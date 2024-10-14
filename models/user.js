const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: String,
  link: String,
  type: String,
  caption: String,
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  files: [fileSchema],
  fileCount: { type: Number, default: 0 }
});

// Ensure no model overwrite
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
