const admin=require("firebase-admin");
if(!process.env.FIREBASE_KEY)throw new Error("Missing FIREBASE_KEY environment variable.");
if(!admin.apps.length){let serviceAccount;try{serviceAccount=JSON.parse(process.env.FIREBASE_KEY);}catch{throw new Error("FIREBASE_KEY must contain valid Firebase service-account JSON.");}admin.initializeApp({credential:admin.credential.cert(serviceAccount)});}
module.exports={admin,db:admin.firestore()};