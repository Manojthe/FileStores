const TelegramBot = require('node-telegram-bot-api');

// Function to check if user is in the channel
async function checkChannelSubscription(bot, chatId) {
    try {
        const member = await bot.getChatMember(-1002174393042, chatId);
        return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
        console.error('Error checking channel subscription:', error);
        return false;
    }
}


// Middleware-like function to enforce channel subscription
async function requireSubscription(bot, chatId) {
    const isSubscribed = await checkChannelSubscription(bot, chatId);
    if (!isSubscribed) {
        const replyMarkup = {
            inline_keyboard: [[
                {
                    text: "Join our channel", // Button text
                    url: "https://t.me/botsupports_og" // Button URL
                }
            ]]
        };

        // Sending a message with HTML support
        await bot.sendMessage(chatId, 
            `<b>Notice:</b> Due to high server load, access to this free service is restricted to users who are not subscribed to our channel. Please subscribe to gain access.\n\n Please click the button below:`, 
            {
                reply_markup: replyMarkup,
                parse_mode: "HTML" // Enable HTML parsing
            }
        );
        return false; // Indicate that the user is not subscribed
    }
    return true; // Indicate that the user is subscribed
}






module.exports = requireSubscription;
