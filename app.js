const Telegraf = require('telegraf'); // Module to use Telegraf API.
const config = require('./config'); // Configuration file that holds telegraf_token API key.
const session = require('telegraf/session')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const rateLimit = require('telegraf-ratelimit')
var mongoose = require('mongoose');
const User = require('./user');
var ethereum_address = require('ethereum-address'); //used for verifying eth address


mongoose.connect(config.database, {
    socketTimeoutMS: 45000,
    keepAlive: true,
    reconnectTries: 10,
    poolSize: 10
});
const db = mongoose.connection;

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function() {
    console.log('Mongoose default connection open to ');
});

// If the connection throws an error
mongoose.connection.on('error', function(err) {
    console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function() {
    console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection 
process.on('SIGINT', function() {
    mongoose.connection.close(function() {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});


const buttonsLimit = { //sets a limit for user clicks
    window: 1000,
    limit: 1,
    onLimitExceeded: (ctx, next) => {
        if ('callback_query' in ctx.update)
            ctx.answerCbQuery('You`ve pressed buttons too oftern, wait.', true)
            .catch((err) => sendError(err, ctx))
    },
    keyGenerator: (ctx) => {
        return ctx.callbackQuery ? true : false
    }
}


//check connection

db.once('open', function() {
    console.log('connected to mongodb');
});
db.on('error', function(err) {
    console.log(err);
});


var refByNameAsync = function(ctx) { //finds and returns the name of the referrer
    return new Promise(function(resolve, reject) {
        try {
            var RefBy = ctx.session.refBy;
            var findquery = {
                refNumber: RefBy
            };
            User.findOne(findquery, function(err, result) {
                if (err) throw err;
                if (result == null) {


                    //if user doesn't exist
                    ctx.session.refByName = "admin";
                    resolve("found none");
                    return false;

                } else { //if user exists, return it's data
                    ctx.session.refByName = result.telegramUser;
                    resolve("works");
                    console.log("Found TG USER REFFER BY:", ctx.session.refByName);

                }


            });
        } catch (e) {
            reject(e);
            console.log(e);
        }

    });
}
var checkDataAsync = function(ctx) { //checks the inputed user data
    return new Promise(function(resolve, reject) {
        try {
            if (ctx.session.avax && ethereum_address.isAddress(ctx.session.avax.toString())) {
                resolve(true)
                return true;
            } else {
                resolve(false)
                return false;


            }

        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}
var findExistingAsync = function(ctx) { //finds existing members in the database
    return new Promise(function(resolve, reject) {
        try {
            console.log('FINDING EXISTING');
            var userID = ctx.from.id.toString();
            var findquery = {
                refNumber: userID
            };
            User.findOne(findquery, function(err, result) {
                if (err) throw err;
                console.log("Finding result", result);
                if (result == null) {
                    resolve("user doesn't exist");
                    //if user doesn't exist
                    return false;

                } else { //returns data if user exists in 
                    console.log("DATA found!");
                    var refNumber = ctx.session.refNumber;
                    console.log("REF number in finding exisit:", refNumber);
                    User.countDocuments({
                        refBy: refNumber
                    }, function(err, count) {
                        ctx.session.count = count;
                        console.log("count is:", count)
                    });
                    ctx.session.avax = result.ethAddress;
                    ctx.session.twitter = result.twitterUser;
                    ctx.session.refBy = result.refBy;
                    ctx.session.refNumber = result.refNumber;
                    ctx.session.username = result.telegramUser;
/*                     ctx.session.bitcointalk = result.bitcointalk;
                    ctx.session.medium = result.medium;
                    ctx.session.instagram = result.instagram; */
                    ctx.session.found = "1";
                    resolve("User found, returning");
                }

            });

        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}

var saveDataAsync = function(ctx) { //saves data to Mongodb
    return new Promise(function(resolve, reject) {
        try {
            console.log('SAVING DATA');
            var CreationDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') //cleans up creation date 
            var EthAddres = ctx.session.avax.toString();
            if (ctx.session.avax !== undefined) {
                var EthAddres = ctx.session.avax.toString();
                // rest of the code...
            } else {
                reject("error: Ethereum address is undefined");
                return;
            }
            var TwitterUser = ctx.session.twitter.toString();
            var TelegramUser = ctx.session.username.toString();
            var RefNumber = ctx.session.refNumber.toString();
  /*           var Bitcointalk = ctx.session.bitcointalk.toString();
            var Medium = ctx.session.medium.toString();
            var Instagram = ctx.session.instagram.toString(); */
            var RefBy = "0";
            if (ctx.session.refBy != null) {
                RefBy = ctx.session.refBy;
            } else {
                RefBy = "0";
            }
            var findquery = {
                refNumber: RefNumber
            };
            User.findOne(findquery, function(err, result) {
                console.log("FIND ONE");
                let myobj = new User({
                    ethAddress: EthAddres,
                    twitterUser: TwitterUser,
                    telegramUser: TelegramUser,
                    refNumber: RefNumber,
                    refBy: RefBy,
 /*                    bitcointalk: Bitcointalk,
                    medium: Medium,
                    instagram: Instagram, */
                    creationDate: CreationDate
                })

                if (err) {
                    reject("error");
                }
                console.log("finding result", result);
                if (result == null) { //if it doesn't find an existing user, saves the current data
                    myobj.save(function(err) {
                        if (err) {
                            reject("error saving");
                            console.log("Error while saving:", err);
                            return;
                        } else {
                            if (RefBy !== "0") {
                                ctx.telegram.sendMessage(RefBy, `🎉 New referral joined!\nUsername: @${TelegramUser}`);
                            }
                            resolve("Saved data");
                            console.log("1 document inserted");
                        }
                    });
                } else { //if it finds an existing user, it updates the data
                    User.findOneAndUpdate({
                        refNumber: RefNumber
                    }, {
                        $set: {
                            ethAddress: EthAddres,
                            twitterUser: TwitterUser,
                            telegramUser: TelegramUser,
                            refNumber: RefNumber,
                            refBy: RefBy,
/*                             bitcointalk: Bitcointalk,
                            medium: Medium,
                            instagram: Instagram, */
                            creationDate: CreationDate
                        }
                    }, {
                        new: true
                    }, (err, doc) => {
                        if (err) {
                            reject("error updating");
                            console.log("error updating:", err);
                        } else {
                            resolve("Saved existing data");
                            ctx.session.step = 6;
                            console.log(doc);
                        }
                    });
                }
            });
        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}

const taskKeyboard = Markup.inlineKeyboard([
    Markup.callbackButton('Like ❤️', 'like'),
    Markup.callbackButton('Retweet 🔁', 'retweet'),
    Markup.callbackButton('Comment 💬', 'comment'),
    Markup.callbackButton('Back to dashboard', 'refresh'),
], {
    columns: 2
});

//keyboard
const keyboard = Markup.inlineKeyboard([
    Markup.callbackButton('AVAX🔑', 'avax'),
    Markup.callbackButton('🐦Twitter', 'twitter'),
/*     Markup.callbackButton('Medium📖', 'medium'),
    Markup.callbackButton('📷Instagram', 'instagram'),
    Markup.callbackButton('Bitcointalk📢', 'bitcointalk'), */
    Markup.callbackButton('♻️Refresh', 'refresh'),
    Markup.callbackButton('✅tasks', 'tasks'),
    Markup.callbackButton('Confirm/Update info✅', 'confirm')
], {
    columns: 3
})

const keyboard1 = Markup.inlineKeyboard([
    Markup.callbackButton('AVAX🔑', 'avax'),
    Markup.callbackButton('🐦Twitter', 'twitter'),
/*     Markup.callbackButton('Medium📖', 'medium'),
    Markup.callbackButton('📷Instagram', 'instagram'),
    Markup.callbackButton('Bitcointalk📢', 'bitcointalk'),
    Markup.callbackButton('♻️Refresh', 'refresh'),*/
    Markup.callbackButton('Confirm/Update info✅', 'confirm')
], {
    columns: 3
})

function firstMessage(ctx) {

    var finalResult;

    finalResult = "⚔️Welcome to WHINE Airdrop bot!⚔️"
    finalResult += "\n"
    finalResult += "\n"
    finalResult += "1.📌Follow us on Twitter: https://x.com/whinememecoin"
    finalResult += "\n"
    finalResult += "2.📌Join our Telegram channel: https://t.me/whinememecoin"
    finalResult += "\n"
    finalResult += "3.📌Every day/week, we will post daily/weekly tasks and bounties in our bot";
    finalResult += "\n";
    finalResult += "4.📌For any special bounties (eg. Telegram stickers, Telegram staking calculator bot, or any other unique idea) please contact x.com/whinememecoin";
    finalResult += "\n";
    finalResult += "5.⚠️⚠️ Please click on the buttons and input all the required data and then click CONFIRM✅ at the end. Only AVAX address is required to confirm.⚠️⚠️";

    return finalResult;
}


function makeMessage(ctx) {
    var finalResult;
/*     finalResult = "👤ID: "
    finalResult += ctx.from.id
    finalResult += "\n" */
    finalResult = "🔑AVAX Address: "
    finalResult += ctx.session.avax
    finalResult += "\n"
    finalResult += "🐦Twitter username: "
    finalResult += ctx.session.twitter
    finalResult += "\n"
/*     finalResult += "📖Medium username: "
    finalResult += ctx.session.medium
    finalResult += "\n"
    finalResult += "📷Instagram username: "
    finalResult += ctx.session.instagram
    finalResult += "\n";
    finalResult += "📢Bitcointalk user ID: ";
    finalResult += ctx.session.bitcointalk;
    finalResult += "\n"; */
    finalResult += "💰No of Airdrop claims Today: ";
    finalResult += ctx.session.dailyClaims;
    finalResult += "\n";
    finalResult += "💰Total No. of claims: ";
    finalResult += ctx.session.totalClaims;
    finalResult += "\n";
    finalResult += "💰Balance: ";
    finalResult += ctx.session.referralBonuses
    finalResult += "\n";
    finalResult += "💰Referral link: https://t.me/whinememecoin_bot?start=";
    finalResult += ctx.session.refNumber;
    finalResult += "\n";
    finalResult += "💵Number of referrals: ";
    finalResult += ctx.session.count;
    finalResult += "\n";
    finalResult += "👥Referred by: ";
    finalResult += ctx.session.refByName

    return finalResult;
}

async function initMessage(ctx) {
    if (ctx.session.found != "1") {
/*         ctx.session.medium = "nil";
        ctx.session.instagram = "nil"; */
    } else {
        //values already set
    }

}
function task(ctx) {
var tasks = [
    { id: 1, description: '[Like ❤️](https://twitter.com/whinememecoin) any of our post on Twitter (Max= 3 post)', reward: 100},       
    { id: 2, description: '[Comment 💬](https://twitter.com/whinememecoin) on any of our post on Twitter and Tag 3 friends (Max= 3 post)', reward: 100},
    { id: 3, description: `[Retweet 🔁](https://twitter.com/whinememecoin) any of our post on Twitter and Tag 3 friends (Max= 3 post)`, reward: 100},
    { id: 4, description: `Refer(https://t.me/whinememecoin_bot?start=${ctx.session.refNumber}) a user to claim (Max= Unlimited)`, reward: 1000 },

];
const availableTasks = tasks.filter(task => !ctx.session.completedTasks.includes(task.id));
const taskList = availableTasks.map(task => `${task.id}. ${task.description} - ${task.reward} $WHINE tokens`);
const msg = `Available tasks:\n${taskList.join('\n')}\n\nUse the buttons below to complete the task or share your referral link`;
return msg;
}

async function stepCheck(ctx) { //step check
    if (ctx.session.step == 5) {
        ctx.session.instagram = ctx.message.text;
        var msg = makeMessage(ctx);
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
    } else if (ctx.session.step == 4) {
        ctx.session.medium = ctx.message.text;
        var msg = makeMessage(ctx);
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
    } else if (ctx.session.step == 3) {
        ctx.session.bitcointalk = ctx.message.text;
        var msg = makeMessage(ctx);
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
    } else if (ctx.session.step == 2) {
        ctx.session.twitter = ctx.message.text;
        var msg = makeMessage(ctx);
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard1))
    } else if (ctx.session.step == 1) {
        if (ethereum_address.isAddress(ctx.message.text.toString())) {
            ctx.session.avax = ctx.message.text;
            var msg = makeMessage(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard1))
        } else {
            ctx.reply("Please input a valid Avax wallet address!");
        }
    } else if (ctx.session.step == 6) {
        const userId = ctx.from.id.toString();
        const user = await User.findOne({ refNumber: userId });

        if (user && user.dailylikeClaims < 3) {
            // Update user's claims
            user.dailyClaims += 1;
            user.dailylikeClaims += 1;
            user.totalClaims += 1;

            user.taskbal += 100;
    
            // Adjust the logic based on your specific requirements
            // For example, limit users to claiming only 3 times a day
            user.referralBonuses = user.refbal + user.taskbal; // Adjust the referral bonus amount

            user.Claims.push({
                username: ctx.message.text,
            });
    
            await user.save();
    
            
            ctx.reply('Task completed! You earned 100 $WHINE tokens.');
            const msg = task(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
        } else {
            ctx.reply(`You have already claimed ${user.dailylikeClaims} times`);
        }
      
    } else if (ctx.session.step == 8) {
        const userId = ctx.from.id.toString();
        const user = await User.findOne({ refNumber: userId });

        if (user && user.dailycommentClaims < 3) {
            // Update user's claims
            user.dailyClaims += 1;
            user.dailycommentClaims += 1;
            user.totalClaims += 1;


            user.taskbal += 100;
    
            // Adjust the logic based on your specific requirements
            // For example, limit users to claiming only 3 times a day
            user.referralBonuses = user.refbal + user.taskbal; // Adjust the referral bonus amount

            user.Claimscomment.push({
                text: ctx.message.text,
            });
    
            await user.save();
    
            ctx.reply('Task completed! You earned 100 $WHINE tokens.');
            const msg = task(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
        } else {
            ctx.reply(`You have already claimed ${user.dailycommentClaims} times`);
        }
    } else if (ctx.session.step == 7) {
        const userId = ctx.from.id.toString();
        const user = await User.findOne({ refNumber: userId });

        if (user && user.dailyretweetClaims < 3) {
            // Update user's claims
            user.dailyClaims += 1;
            user.dailyretweetClaims += 1;
            user.totalClaims += 1;

            user.taskbal += 100;
    
            // Adjust the logic based on your specific requirements
            // For example, limit users to claiming only 3 times a day
            user.referralBonuses = user.refbal + user.taskbal;
            
            user.Claimsretweet.push({
                text: ctx.message.text
            });
    
            await user.save();

            ctx.reply('Task completed! You earned 100 $WHINE tokens.');
            const msg = task(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
        } else {
            ctx.reply(`You have already claimed ${user.dailyretweetClaims} times`);
        }
    } else {
        console.log("other data");
    }
}

//bot init
const bot = new Telegraf(config.telegraf_token); // Let's instantiate a bot using our token.
bot.use(session())
bot.use(Telegraf.log())

const adminUserIds = ['304940279'];

// Middleware to check if the user is an admin
const isAdmin = (ctx, next) => {
    const userId = ctx.from.id.toString();
    if (adminUserIds.includes(userId)) {
        return next();
    } else {
        ctx.reply('You are not authorized to perform this action.');
    }
};

// Command to send notifications (only accessible by admins)
bot.command('notify', isAdmin, async (ctx) => {
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (message) {
        // Broadcast the notification to all users
        const users = await User.find();
        for (const user of users) {
            ctx.telegram.sendMessage(user.refNumber, message);
        }

        ctx.reply('Notification sent to all users.');
    } else {
        ctx.reply('Please provide a message for the notification.');
    }
});

// Middleware to handle daily claims and referral bonuses
bot.use(async (ctx, next) => {
    const userId = ctx.from.id.toString();
    const user = await User.findOne({ refNumber: userId });

    if (user) {
        const today = new Date().toLocaleDateString();

        // Reset daily claims if a new day has started
        if (user.lastClaimDate !== today) {
            user.lastClaimDate = today;
            user.dailyClaims = 0;
            user.dailylikeClaims = 0;
            user.dailycommentClaims = 0;
            user.dailyretweetClaims = 0;
            await user.save();
        }

        // Reset completed tasks if a new day has started
        if (user.lastTaskResetDate !== today) {
            user.lastTaskResetDate = today;
            user.completedTasks = [];
        }


        

        ctx.session.dailyClaims = user.dailyClaims;
        ctx.session.dailylikeClaims = user.dailylikeClaims;
        ctx.session.dailycommentClaims = user.dailycommentClaims;
        ctx.session.dailyretweetClaims = user.dailyretweetClaims;
        ctx.session.totalClaims = user.totalClaims;
        ctx.session.completedTasks = user.completedTasks;
        ctx.session.referralBonuses = user.referralBonuses;
    }

    return next();
});

bot.action('tasks', async (ctx) => {
    var msg = task(ctx);

    if (msg.length > 0 && (ctx.session.dailylikeClaims < 3 || ctx.session.dailycommentClaims < 3 || ctx.session.dailyretweetClaims < 3)) {
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
    } else {
        ctx.reply(`We appreciate your interest in our tasks. Unfortunately, all available tasks for today have been claimed. Please check back tomorrow for new opportunities or consider referring others using the following link to earn additional rewards: [https://t.me/whinememecoin_bot?start=${ctx.session.refNumber}]. Thank you for your understanding and participation.`);
    }
});

bot.start(async (ctx) => { //bot start
    //parameter parsing
    ctx.session.refByName = "/"
    ctx.session.count = 0;
    findExistingAsync(ctx).then(function(uid) {
        var len = ctx.message.text.length;
        console.log("chat id is:", ctx.from.id)
        console.log("length", len);
        if (ctx.from.username == null) //user must have a valid username set.
        {
            var nousrmsg = "Please set a username first then contact the bot again!";
            ctx.telegram.sendMessage(ctx.from.id, nousrmsg)

        } else {
            ctx.session.username = ctx.from.username;
            var ref = ctx.message.text.slice(7, len);
            ctx.session.refBy = ref;
            console.log("ref:", ref);
            if (ref.length != 0) {
                var refmsg = "Referred by: " + ctx.session.refBy;

                ctx.session.refNumber = ctx.from.id.toString();
                ctx.telegram.sendMessage(ctx.from.id, refmsg);
                console.log("refer", ctx.session.refBy);
            } else {
                ctx.session.refNumber = ctx.from.id.toString();
                console.log("session ref number:", ctx.session.refNumber);
            }
            //save referer
            ctx.session.telegram = ctx.message.chat.username;
            ctx.session.language = ctx.message.from.language_code;

            initMessage(ctx);
            var msg = firstMessage(ctx);
            // var msg = makeMessage(ctx);

            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.markup(keyboard1))
        }

    });
})
bot.on('message', async (ctx) => { //bot listens to any message 
    if (ctx.from.username == null) {
        var nousrmsg = "Please set a username first then contact the bot again!";
        ctx.telegram.sendMessage(ctx.from.id, nousrmsg)

    } else {
        console.log("sesison found in message:", ctx.session.found);
        ctx.session.refNumber = ctx.from.id.toString();
        if (ctx.session.found != "1") {

            findExistingAsync(ctx).then(function(uid) {
                //wait for promise to complete.
            });
        }
        console.log("ref by name", ctx.session.refByName);
        if (ctx.session.refByName == null) //checks if refbyname exists, speeds up concurrent calls.
        {
            refByNameAsync(ctx).then(function(uid) {
                stepCheck(ctx);
            });
        } else {
            stepCheck(ctx);
        }
    }
})

bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: " + bot_informations.username);
});

bot.action('delete', ({
    deleteMessage
}) => deleteMessage())


bot.action('avax', (ctx) => { //button click ETH
    ctx.reply("Input your Avalanche wallet address.");
    ctx.session.step = 1;
});

bot.action('twitter', (ctx) => { //button click twitter
    ctx.reply("Input Twitter username, please.");
    ctx.session.step = 2;
});

/* bot.action('bitcointalk', (ctx) => { //button click bitcointalk
    ctx.reply("Input your Bitcointalk user ID, please. (numbers that come after u=)");
    ctx.session.step = 3;
});

bot.action('medium', (ctx) => { //button click medium
    ctx.reply("Input your Medium username, please.");
    ctx.session.step = 4;
});

bot.action('instagram', (ctx) => { //button click instagram
    ctx.reply("Input your Instagram username, please.");
    ctx.session.step = 5;
}); */

bot.action('like', async (ctx) => { //button click like
    if(ctx.session.dailylikeClaims < 3) {
        ctx.reply("Input your username, please to confirm");
        ctx.session.step = 6;
    } else {
        if (ctx.session.dailycommentClaims < 3 || ctx.session.dailyretweetClaims < 3) {
        const msg = task(ctx);
        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
        ctx.reply(`You have already claimed the Like Task ${ctx.session.dailylikeClaims} times`);
        } else {
            await refByNameAsync(ctx);
            await findExistingAsync(ctx);
            var msg = makeMessage(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard)) 
            ctx.reply(`You have reached your daily claimed Limit of ${ctx.session.dailyClaims} times`); 
        }
        
    }
});

bot.action('retweet',async (ctx) => { //button click retweet
    if(ctx.session.dailyretweetClaims < 3) {
        ctx.reply("Input your retweet link e.g, please to confirm");
        ctx.session.step = 7;
    } else {
        if (ctx.session.dailycommentClaims < 3 || ctx.session.dailylikeClaims < 3) {
            const msg = task(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
            ctx.reply(`You have already claimed the Retweet Task ${ctx.session.dailyretweetClaims} times`);
            } else {
                await refByNameAsync(ctx);
                await findExistingAsync(ctx);
                var msg = makeMessage(ctx);
                ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
                ctx.reply(`You have reached your daily claimed Limit of ${ctx.session.dailyClaims} times`);
            }
        
    }
});

bot.action('comment',async (ctx) => { //button click comment
    if(ctx.session.dailycommentClaims < 3) {
        ctx.reply("Input your comment link, please to confirm");
        ctx.session.step = 8;
    } else {
        if (ctx.session.dailylikeClaims < 3 || ctx.session.dailyretweetClaims < 3) {
            const msg = task(ctx);
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(taskKeyboard))
            ctx.reply(`You have already claimed the Comment Task ${ctx.session.dailycommentClaims} times`);
            } else {
                await refByNameAsync(ctx);
                await findExistingAsync(ctx);
                var msg = makeMessage(ctx);
                ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
                ctx.reply(`You have reached your daily claimed Limit of ${ctx.session.dailyClaims} times`);
            }
    }
});

bot.action('refresh',async (ctx) => { //button click refresh data
    const userId = ctx.from.id.toString();
    const user = await User.findOne({ refNumber: userId });

    if (ctx.session.count > user.refcount) {
    user.refcount = ctx.session.count;
    const referralBonus = 1000; // Set your referral bonus amount
    user.refbal = referralBonus * user.refcount;
    user.referralBonuses = user.refbal + user.taskbal;
    await user.save();
    }
    
    
    await refByNameAsync(ctx);
    await findExistingAsync(ctx);
    var msg = makeMessage(ctx);
    ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
    ctx.reply("Data has been refreshed!");
});

bot.action('confirm', (ctx) => { //button click confirm
    checkDataAsync(ctx).then(function(uid) {
        var check = uid;
        console.log("CHECK", check);
        refByNameAsync(ctx).then(function(uid) {
            if (check == true) {
                var msg = makeMessage(ctx);
                refByNameAsync(ctx).then(function(uid) {
                    findExistingAsync(ctx).then(function(uid) {
                        ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
                            ctx.reply("Data has been refreshed!");
                    });
                });
                saveDataAsync(ctx).then(function(uid) {
                    var msg;
                    msg = "Completed.";
                    msg += "\n";
                    msg += "Please use this referral link";
                    msg += "\n";
                    msg += "https://t.me/whinememecoin_bot?start=";
                    msg += ctx.session.refNumber;
                    ctx.reply(msg);
                });
            } else {
                ctx.reply("Please input all data");
            }
        });
    });
});
bot.use(rateLimit(buttonsLimit))
bot.startPolling(); //MUST HAVE
