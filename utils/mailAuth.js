const { google } = require("googleapis");

const CLIENT_ID = "762556497989-53mgepsksaua89un5q2asgffiocfj8ca.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = "1//04oFTa8ZUP3wVCgYIARAAGAQSNwF-L9IrlFmxBy98-uIXTBNTv1tdZyLrbP_rTcYslTZd4MZ_pb-0RPyi1OncQ6isYCxzFOPGZ2U";

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendMail(to, subject, body) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const rawMessage = [
    `To: ${to}`,
    "Subject: " + subject,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return result;
}

module.exports = sendMail;
