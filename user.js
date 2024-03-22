var mongoose= require('mongoose');

//user Schema
var UserSchema = mongoose.Schema({
    ethAddress:{
        type: String,
        required: true
    
    },
    twitterUser:{
        type: String,
        required: false
    
    },
    telegramUser:{
        type: String,
        required:true
    },
    refNumber:{
        type: String,
        required: true
    },
    refBy: {
        type: String,
        required: false
    },
    refcount: {
        type: String,
        required: false
    },
    Claims: [
        {
            date: { type: Date, default: Date.now },
            text: { type: String },
        },
    ],
    Claimscomment: [
        {
            date: { type: Date, default: Date.now },
            text: { type: String },
        },
    ],
    Claimsretweet: [
        {
            date: { type: Date, default: Date.now },
            text: { type: String },
        },
    ],

    dailyClaims: { 
        type: Number, 
        default: 0 
    },
    dailylikeClaims: { 
        type: Number, 
        default: 0 
    },
    dailycommentClaims: { 
        type: Number, 
        default: 0 
    },
    dailyretweetClaims: { 
        type: Number, 
        default: 0 
    },
    totalClaims: { 
        type: Number, 
        default: 0 
    },
    referralBonuses: { 
        type: Number, 
        default: 0 
    },
    refbal: { 
        type: Number, 
        default: 0 
    },
    taskbal: { 
        type: Number, 
        default: 0 
    },
    bitcointalk: {
        type: String,
        required: false
    },
    medium: {
        type: String,
        required: false
    },
    instagram: {
        type: String,
        required: false
    },
    lastClaimDate: {
        type : String,
        required:false
    },
    creationDate: {
        type : String,
        required:false
    }
});

module.exports=mongoose.model('User',UserSchema);
