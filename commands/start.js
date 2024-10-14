// commands/start.js

const sendStartMessage = async (bot, chatId) => { // Pass bot as first parameter
    const welcomeMessage = "<blockquote>Hello, <b> Dear User </b>!</blockquote>\n\n<b>Unlimited Storage Telegram Bot</b>\n\nMaximize your storage capabilities with the Unlimited Storage Telegram bot. Easily store and share your files with friends and colleagues. Type /help to explore more features and benefits..";
    const placeholderImageUrl = "https://via.placeholder.com/400x200.png?text=Welcome"; // Placeholder image URL

    // Create the inline keyboard buttons
    const inlineKeyboard = [
        [
            { text: "Button 1", callback_data: "button1" },
            { text: "Button 2", callback_data: "button2" },
        ],
        [
            { text: "Button 3", callback_data: "button3" },
            { text: "Button 4", callback_data: "button4" },
        ]
    ];

    try {
        // Send the welcome image with HTML formatted caption and inline keyboard
        await bot.sendPhoto(chatId, placeholderImageUrl, {
            caption: welcomeMessage,
            parse_mode: "HTML", // Enable HTML formatting in the caption
            reply_markup: {
                inline_keyboard: inlineKeyboard // Attach the inline keyboard
            }
        });
    } catch (error) {
        console.error("Error sending start message:", error);
    }
};

module.exports = sendStartMessage;
