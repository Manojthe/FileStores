const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const { botToken, channelId, mongoURI, botUsername } = require('./info');
const sendStartMessage = require('./commands/start'); // Import the start command
const sendHelpMessage = require('./commands/help');
const requireSubscription = require('./commands/checkChannel'); // Import the subscription check



// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log(err));

// Define File Schema
const fileSchema = new mongoose.Schema({
    fileName: String,
    fileSize: String,
    fileId: String, // Telegram's file ID for sending
    messageId: String, // Telegram's message ID for linking
    batchId: String, // Identifier for batch
    fileLink: String,
    fileType: String // Document, photo, video, audio
});

// Define User Schema with embedded files
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true }, // Unique user ID
    files: [fileSchema] // Array of files associated with the user
});

// Create Models
const User = mongoose.model('User', userSchema);

// Initialize the Express app
const app = express(); // Create an instance of Express

// Initialize the bot
const bot = new TelegramBot(botToken, { polling: true });

let activeBatches = {}; // To keep track of batch sessions (keyed by userId)

// Utility function to format file size
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Utility function to generate file link in Telegram format
function generateFileLink(fileId) {
    return `https://t.me/${botUsername}?start=${fileId}`;
}

// Middleware to serve static files
app.use(express.static('public')); // Assumes your HTML file is in the "public" directory

// API endpoint to fetch files
app.get('/api/files', async (req, res) => {
    try {
        const users = await User.find(); // Fetch all users
        const files = users.flatMap(user => user.files); // Flatten the array of files from all users
        res.json(files); // Send files as JSON response
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route for the main HTML page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Serve the HTML file
});

// Handle /startbatch command to initiate a batch
bot.onText(/\/startbatch/, (msg) => {
    const chatId = msg.chat.id;
    const batchId = `batch-${Date.now()}-${chatId}`;

    activeBatches[chatId] = {
        batchId: batchId,
        files: [] // Array to hold files added to this batch
    };

    bot.sendMessage(chatId, "Batch mode started. Send the files you want to batch together, and end with /endbatch.");
});

// Handle /endbatch command to finalize and generate batch link
bot.onText(/\/endbatch/, async (msg) => {
    const chatId = msg.chat.id;

    if (!activeBatches[chatId] || activeBatches[chatId].files.length === 0) {
        return bot.sendMessage(chatId, "No batch in progress or no files have been added.");
    }

    const batch = activeBatches[chatId];
    const batchLink = generateFileLink(batch.batchId);

    // Save all files in the batch for the user
    const user = await User.findOne({ userId: chatId }) || new User({ userId: chatId, files: [] });

    // Loop through each file and save to the user's files array
    for (const file of batch.files) {
        user.files.push({ ...file, batchId: batch.batchId, fileLink: batchLink });
    }

    await user.save(); // Save the user document with updated files

    bot.sendMessage(chatId, `Batch saved! Here's your link: ${batchLink}`);
    delete activeBatches[chatId]; // Clear the batch after processing
});

// Handle incoming files during batch session or single uploads
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;


// Check subscription in one line
    if (!(await requireSubscription(bot, chatId))) return; // If not subscribed, exit

    

    if (msg.document || msg.photo || msg.video || msg.audio) {
        let fileType;
        let fileId;
        let fileName;
        let fileSize;

        // Identify the file type and extract relevant info
        if (msg.document) {
            fileType = 'document';
            fileId = msg.document.file_id;
            fileName = msg.document.file_name;
            fileSize = formatFileSize(msg.document.file_size);
        } else if (msg.photo) {
            fileType = 'photo';
            const largestPhoto = msg.photo[msg.photo.length - 1];
            fileId = largestPhoto.file_id;
            fileName = 'photo';
            fileSize = formatFileSize(largestPhoto.file_size);
        } else if (msg.video) {
            fileType = 'video';
            fileId = msg.video.file_id;
            fileName = msg.video.file_name || 'video';
            fileSize = formatFileSize(msg.video.file_size);
        } else if (msg.audio) {
            fileType = 'audio';
            fileId = msg.audio.file_id;
            fileName = msg.audio.file_name || 'audio';
            fileSize = formatFileSize(msg.audio.file_size);
        }

        // Forward the file to the channel
        const sentMsg = await bot.forwardMessage(channelId, chatId, msg.message_id);

        // Prepare file record object
        const fileRecord = {
            fileName: fileName,
            fileSize: fileSize,
            fileId: fileId,
            messageId: sentMsg.message_id, // Save the forwarded message_id
            fileType: fileType,
            fileLink: generateFileLink(sentMsg.message_id) // Single file link
        };

        // Check if user already exists
        let user = await User.findOne({ userId: chatId });

        if (!user) {
            // If user doesn't exist, create a new user
            user = new User({
                userId: chatId,
                files: [fileRecord] // Add the file to the user's files
            });
        } else {
            // If user exists, push the new file record to the existing user's files
            user.files.push(fileRecord);
        }

        // Save user with files
        await user.save();

        // If batch mode is active for this user, save file to batch
        if (activeBatches[chatId]) {
            activeBatches[chatId].files.push(fileRecord); // Add to the batch
            bot.sendMessage(chatId, `File added to batch! (${fileName})`);
        } else {
            // If not in batch mode, send file link directly
            bot.sendMessage(chatId, `File saved! Here's your link: ${fileRecord.fileLink}`);
        }
    }
});




// Handle /start command for both file retrieval and the welcome message
bot.onText(/\/start(?:\s*(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Check subscription in one line
    if (!(await requireSubscription(bot, chatId))) return; // If not subscribed, exit

    // Check if a parameter (batchId or messageId) is passed after /start
    const param = match[1]; // This gets the parameter after `/start `, if any

    if (param) {
        console.log(`/start command received with param: ${param}`);

        // Check if the parameter is a batch ID
        const batchFiles = await User.find({ 'files.batchId': param }); // Find users with that batch ID

        if (batchFiles.length > 0) {
            // Send all files in the batch
            for (const user of batchFiles) {
                const filesToSend = user.files.filter(file => file.batchId === param); // Filter files with the batch ID
                for (const foundFile of filesToSend) {
                    console.log('File found in MongoDB:', foundFile);
                    // Send file based on its type
                    switch (foundFile.fileType) {
                        case 'document':
                            await bot.sendDocument(chatId, foundFile.fileId);
                            break;
                        case 'photo':
                            await bot.sendPhoto(chatId, foundFile.fileId);
                            break;
                        case 'video':
                            await bot.sendVideo(chatId, foundFile.fileId);
                            break;
                        case 'audio':
                            await bot.sendAudio(chatId, foundFile.fileId);
                            break;
                        default:
                            await bot.sendMessage(chatId, 'File type not recognized.');
                    }
                }
            }
            return; // Exit after sending all files in the batch
        }

        // If no batch found, check for a file with the messageId from the param
        const file = await User.findOne({ 'files.messageId': param }, { 'files.$': 1 });

        if (file && file.files.length > 0) {
            const foundFile = file.files[0]; // Get the found file
            console.log('File found in MongoDB:', foundFile);
            // Send file based on its type
            switch (foundFile.fileType) {
                case 'document':
                    await bot.sendDocument(chatId, foundFile.fileId);
                    break;
                case 'photo':
                    await bot.sendPhoto(chatId, foundFile.fileId);
                    break;
                case 'video':
                    await bot.sendVideo(chatId, foundFile.fileId);
                    break;
                case 'audio':
                    await bot.sendAudio(chatId, foundFile.fileId);
                    break;
                default:
                    await bot.sendMessage(chatId, 'File type not recognized.');
            }
            return; // Exit after sending the single file
        }

        // If no file found
        await bot.sendMessage(chatId, 'No file found with that link.');
    } else {
        // No parameter provided, just run the start message
        await sendStartMessage(bot, chatId);
    }
});



// Handle /help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;

// Check subscription in one line
    if (!(await requireSubscription(bot, chatId))) return; // If not subscribed, exit

    await sendHelpMessage(bot, chatId);
});


// Start the Express server
const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});




