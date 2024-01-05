const mongoose = require('mongoose');
const Schema = mongoose.Schema; // 正确导入Schema
const noteSchema = new mongoose.Schema({
    arxivId: { type: String, required: true },
    note: { type: String, required: true },
    date: { type: Date, default: Date.now }
});
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    readHistory: {
        type: Schema.Types.Mixed,
        default: {}
    },
    interesting: {
        type: Schema.Types.Mixed,
        default: []
    },
    notes: [noteSchema],
    categories: {
        type: Schema.Types.Mixed,
        default: []
    }
});


module.exports = mongoose.model('User', userSchema);
