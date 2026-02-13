const transporter = require('../config/mailer');

async function sendOtpEmail(to, otp, purpose = 'register') {
  let subject, headline, introMessage, actionMessage;


  if (purpose === 'login') {
    subject = 'Login Verification – Your OTP Code Inside 🔐';
    headline = 'Secure Login Verification 🔑';
    introMessage = 'You recently requested to log in. Use the OTP below to complete your login.';
    actionMessage = 'This OTP will expire in <b>5 minutes</b>. If this wasn’t you, please secure your account immediately by changing your password.';
  } else if (purpose === 'resend') {
    subject = 'Resend OTP – Complete Your Verification ✔️';
    headline = 'Here’s Your New OTP Code';
    introMessage = 'As requested, we’ve sent you a new OTP. Use it below to complete your verification.';
    actionMessage = 'This OTP will expire in <b>5 minutes</b>. Please use it before it expires.';
  } else {

    subject = 'Complete Your Registration – Verify Your Email 📩';
    headline = 'Email Verification Required';
    introMessage = 'Thanks for signing up! Use the OTP below to verify your email address and activate your account.';
    actionMessage = 'This OTP will expire in <b>5 minutes</b>. Please use it to complete your registration.';
  }


  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4CAF50; text-align: center;">${headline}</h2>
        <p>${introMessage}</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #4CAF50; background: #f9f9f9; padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc;">
            ${otp}
          </span>
        </div>

        <p>${actionMessage}</p>
        
        <p>If you didn’t request this, you can safely ignore this email.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #777; text-align: center;">
          Need help? Contact our support team at <a href="mailto:support@digital_asset.com">support@digital_asset.com</a>.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Error sending OTP email:', err);
    return false;
  }
}

async function sendNewAdminEmail (email, full_name, password, role_name) {
  try {
    const mailOptions = {
    from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Admin Account Has Been Created",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Welcome to Digital Assets Admin Team</h2>
        <p>Hi ${full_name},</p>
        <p>You have been added as a <b>${role_name}</b> in the Digital Assets Admin system.</p>
        <p>Here are your login credentials:</p>
        <ul>
          <li><b>Email:</b> ${email}</li>
          <li><b>Password:</b> ${password}</li>
        </ul>
        <p>Please log in and change your password immediately after first login for security reasons.</p>
        <p>Thank you,<br/> Digital Assets Security Team</p>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("❌ sendNewAdminEmail error:", err);
    return false;
  }
}; 

async function sendRegisteredAdminEmail (email, full_name, role_name) {
  try {
    const mailOptions = {
    from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Admin Account Has Been Created",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Welcome to Digital Assets Admin Team</h2>
        <p>Hi ${full_name},</p>
        <p>You have been added as a <b>${role_name}</b> in the Digital Assets Admin system.</p>
        <p>Here are your login credentials:</p>
        <ul>
          <li><b>Email:</b> ${email}</li>
        </ul>
        <p>Thank you,<br/>Digital Assets Security Team</p>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("❌ sendNewAdminEmail error:", err);
    return false;
  }
};

async function sendNotificationEmail(to, subject, html) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  };
  return transporter.sendMail(mailOptions);
}

async function sendAdminAttemptEmail(toEmail, attemptData) {
  const { full_name, email} = attemptData;
  const subject = "Blocked Admin Registration Attempt";
  const text = `A new admin registration attempt was blocked.\n\nFull Name: ${full_name}\nEmail: ${email}}`;
  
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject,
    text,
  });
}



module.exports = { sendOtpEmail, sendNewAdminEmail, sendRegisteredAdminEmail, sendNotificationEmail, sendAdminAttemptEmail };