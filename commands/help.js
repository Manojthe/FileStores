// commands/help.js

module.exports = async function sendHelpMessage(bot, chatId) {
    const helpMessage = `
    <b>Help Menu:</b>
    1. <b>/start</b> - Start the bot or retrieve files with a link.
    2. <b>/startbatch</b> - Start a batch mode for uploading multiple files.
    3. <b>/endbatch</b> - End the batch and receive a link to the files.
    4. <b>/help</b> - Show this help message.
    
    You can send files directly to this chat, and I will generate a link for them. If you're in batch mode, send multiple files and receive one link for the entire batch.
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
};
