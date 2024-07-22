const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.getFile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const filePath = data.filePath;
  
  try {
    const bucket = admin.storage().bucket();
    const [fileContents] = await bucket.file(filePath).download();
    return { fileContents: fileContents.toString('base64') };
  } catch (error) {
    throw new functions.https.HttpsError('unknown', error.message, error);
  }
});