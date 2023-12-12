const mongoose = require('mongoose');
const Schema = mongoose.Schema; // 正确导入Schema

const paperSchema = new mongoose.Schema({
    arxivId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    authors: { type: String, required: true },
    submitTime: { type: String, required: false, default:"" },
    summary: { type: String, required: true },
    url: { type: String, required: true },
    comments: { type: String, required: false },
    subjects: { type: Schema.Types.Mixed, default:{}}
});
module.exports = mongoose.model('Paper', paperSchema);