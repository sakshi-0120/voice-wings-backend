const crypto = require("crypto");
const hashService = require("./hash-service");

const smsSid = process.env.SMS_SID;
const smsAuthToken = process.env.SMS_AUTH_TOKEN;
// const twilio = require("twilio")(smsSid, smsAuthToken, {
//   lazyLoading: true,
// });

class OtpService {
  async generateOtp() {
    // const otp = crypto.randomInt(1000, 9999);
    return 1234;
  }

  async sendBySms(phone) {
    return await twilio.messages.create({
      to: phone,
      from: process.env.SMS_FROM_NUMBER,
      body: `Your voicewings OTP is ${1234}`,
    });
  }

  verifyOtp(data) {
    let computedHash = hashService.hashOtp(data);
    return computedHash == "1234";
  }
}

module.exports = new OtpService();