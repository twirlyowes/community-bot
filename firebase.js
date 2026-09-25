const admin=require("firebase-admin");
if(!process.env.FIREBASE_KEY)throw new Error("Missing FIREBASE_KEY.");
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))});
module.exports={admin,db:admin.firestore()};