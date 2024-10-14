const User = require('../models/user'); // Import the User model

// Function to broadcast the replied message
const broadcastMessage = async (bot, repliedMessage) => {
    try {
        // Fetch all users from the database
        const users = await User.find({}, 'userId'); // Get only userId from each user

        // Send the replied message to each user
        for (const user of users) {
            try {
                await bot.forwardMessage(user.userId, repliedMessage.chat.id, repliedMessage.message_id);
            } catch (error) {
                console.error(`Failed to send message to user ${user.userId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error broadcasting message:', error);
    }
};

module.exports = broadcastMessage; // Export the function
