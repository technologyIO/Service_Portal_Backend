const nodemailer = require("nodemailer");
const { google } = require("googleapis");

// 🛑 REPLACE these values with your actual credentials
const GMAIL_USER = "shivamt2023@gmail.com";
const CLIENT_ID = "762556497989-53mgepsksaua89un5q2asgffiocfj8ca.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = "1//04oFTa8ZUP3wVCgYIARAAGAQSNwF-L9IrlFmxBy98-uIXTBNTv1tdZyLrbP_rTcYslTZd4MZ_pb-0RPyi1OncQ6isYCxzFOPGZ2U"; // 👈 Use the correct refresh token you got from OAuth playground

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Set the refresh token to fetch access token
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function getTransporter() {
  const accessToken = await oAuth2Client.getAccessToken();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: GMAIL_USER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
      accessToken: accessToken.token,
    },
  });

  return transporter;
}

module.exports = getTransporter;
