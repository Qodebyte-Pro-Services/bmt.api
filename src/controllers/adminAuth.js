const bcrypt = require("bcryptjs");
const { Admin, Role, OTP, sequelize, Settings, LoginAttempt  } = require("../models");
const { generateToken, generateTokenMainToken } = require("../utils/jwt");
const { generateOTP } = require("../utils/otpGenerator");
const { sendOtpEmail, sendNewAdminEmail, sendRegisteredAdminEmail, sendNotificationEmail } = require("../services/emailServices");
const { ALL_PERMISSIONS } = require("../constants/permissions");
const { Op } = require("sequelize");
const { getClientIP } = require("../utils/ipHelper");
const crypto = require("crypto");



const rateLimitMap = new Map();

function rateLimit(key, max = 5, windowMs = 60 * 1000) {
  const now = Date.now();
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, last: now });
  } else {
    const entry = rateLimitMap.get(key);
    if (now - entry.last > windowMs) {
      entry.count = 1;
      entry.last = now;
    } else {
      entry.count++;
    }
    if (entry.count > max) return false;
    rateLimitMap.set(key, entry);
  }
  return true;
}

function validateInput(fields, req, res) {
  for (const field of fields) {
    if (!req.body[field]) {
      res.status(400).json({ message: `Missing field: ${field}` });
      return false;
    }
  }
  return true;
}

function splitFullName(full_name) {
  const parts = full_name.trim().split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}


async function getOrCreateSuperAdminRole(transaction) {
  let superAdmin = await Role.findOne({ where: { role_name: "Super Admin" }, transaction });
  if (!superAdmin) {
    superAdmin = await Role.create(
      {
        role_name: "Super Admin",
        role_count: 1,
        permissions: Object.values(ALL_PERMISSIONS),
      },
      { transaction }
    );

    await Settings.create({
      site_name: "Big Men Transaction Apparel",
      site_logo: null,
      created_by: null,
    },
    { transaction }
    );
  }
  return superAdmin;
}

async function determineAdminRole(admin_role, transaction) {
 
  if (admin_role) return admin_role;

 
  const superAdminRole = await getOrCreateSuperAdminRole(transaction);

  const existingSuperAdmin = await Admin.findOne({
    where: { admin_role: superAdminRole.roles_id },
    transaction,
  });


  if (!existingSuperAdmin) return superAdminRole.roles_id;

 
  const developerRole = await Role.findOne({ where: { role_name: "DEVELOPER" }, transaction });
  if (!developerRole) {
  
    const newDev = await Role.create(
      {
        role_name: "DEVELOPER",
        role_count: 1,
        permissions: Object.values(ALL_PERMISSIONS),
      },
      { transaction }
    );
    return newDev.roles_id;
  }

  const existingDeveloper = await Admin.findOne({
    where: { admin_role: developerRole.roles_id },
    transaction,
  });

  
  if (existingDeveloper) return null;

 
  return developerRole.roles_id;
}



exports.AdminRegister = async (req, res) => {
  if (!rateLimit(req.body.email + ":register")) {
    return res.status(429).json({ message: "Too many attempts, try again later." });
  }

  const t = await sequelize.transaction();

  try {
    const { full_name, email, password, admin_role } = req.body;

    if (!full_name || !email || !password) {
      await t.rollback();
      return res.status(400).json({ message: "Missing required fields." });
    }

    let admin = await Admin.findOne({ where: { email }, transaction: t });

    if (admin) {
      if (admin.isVerified) {
        await t.rollback();
        return res.status(400).json({ message: "Admin already exists" });
      } else {
        admin.password = await bcrypt.hash(password, 10);
        await admin.save({ transaction: t });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);

      
      const roleToAssign = await determineAdminRole(admin_role, t);

     
      if (!roleToAssign) {
     
        const developerRole = await Role.findOne({ where: { role_name: "DEVELOPER" }, transaction: t });
        const existingDeveloper = await Admin.findOne({
          where: { admin_role: developerRole?.roles_id, isVerified: true },
          transaction: t,
        });

        if (existingDeveloper) {
        
          await sendAdminAttemptEmail(existingDeveloper.email, {
            full_name,
            email,
          });
        }

        await t.rollback();
        return res.status(403).json({
          message: "Cannot auto-assign role: Super Admin and Developer roles already exist. Please use the Add Admin panel.",
        });
      }

      admin = await Admin.create(
        {
          full_name,
          email,
          password: hashedPassword,
          isVerified: false,
          admin_role: roleToAssign,
        },
        { transaction: t }
      );

    }

    const otp = generateOTP(6);
    await OTP.create(
      {
        entity_id: admin.admin_id,
        entity_type: "Admin",
        otp,
        purpose: "register",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
      { transaction: t }
    );

    const sent = await sendOtpEmail(email, otp, "register");
    if (!sent) {
      await t.rollback();
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    await t.commit();
    return res.status(201).json({
      message: "OTP sent. Please verify email.",
      admin_id: admin.admin_id,
    });
  } catch (error) {
    await t.rollback();
    console.error("❌ Admin Register error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required." });

  if (!rateLimit(email + ":login"))
    return res.status(429).json({ message: "Too many attempts, try again later." });

  const t = await sequelize.transaction();
  try {
    const admin = await Admin.findOne({
      where: { email },
      include: [
        {
          model: Role,
          attributes: ["roles_id", "role_name"]
        }
      ],
      transaction: t
    });

    if (!admin || !admin.password || !(await bcrypt.compare(password, admin.password))) {
      await t.rollback();
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!admin.isVerified) {
      await t.rollback();
      return res.status(403).json({ message: "Please verify your account." });
    }

    const userAgent = req.headers["user-agent"];
    const ip = getClientIP(req);

    const isSuperAdmin =
  admin.Role?.role_name === "Super Admin" ||
  admin.Role?.role_name === "DEVELOPER";

    if (!isSuperAdmin) {
      const loginAttempt = await LoginAttempt.create({
        admin_id: admin.admin_id,
        email: admin.email,
        device: userAgent,
        location: "Unknown",
        ip_address: ip,
        status: "pending",
      }, { transaction: t });

      const approvers = await Admin.findAll({
        where: {
          admin_id: { [Op.ne]: admin.admin_id }
        },
        include: [{
          model: Role,
          where: { role_name: "Super Admin" },
          attributes: ["roles_id", "role_name"]
        }],
        attributes: ["admin_id", "full_name", "email"],
        transaction: t
      });

      let emailsSent = 0;
      for (const approver of approvers) {
        const sent = await sendNotificationEmail(
          approver.email,
          "🔐 Login Approval Required",
          `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #007bff;">🔐 Login Approval Required</h2>
              <p>Hi ${approver.full_name},</p>
              <p><strong>${admin.full_name}</strong> is attempting to login.</p>
              <table style="border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f5f5f5;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${admin.email}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>IP Address:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${ip}</td>
                </tr>
                <tr style="background: #f5f5f5;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Device:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${userAgent || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Time:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
              <p>Please login into your system to either approve or reject this login attempt.</p>
              <p style="color: #dc3545; font-weight: bold;">⚠️ If this was not you, please contact your administrator immediately.</p>
            </div>
          `
        );
        if (sent) emailsSent++;
      }

      await t.commit();
      return res.status(202).json({
        message: "Login pending approval. Check your email.",
        admin_id: admin.admin_id,
        attempt_id: loginAttempt.login_attempt_id,
        ip_address: ip,
        approvers_notified: emailsSent
      });
    }

    const loginAttempt = await LoginAttempt.create({
      admin_id: admin.admin_id,
      email: admin.email,
      device: userAgent,
      location: "Unknown",
      ip_address: ip,
      status: "approved",
      approved_by: admin.admin_id,
      approved_at: new Date(),
    }, { transaction: t });

    const otp = generateOTP(6);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      entity_id: admin.admin_id,
      entity_type: "Admin",
      otp,
      purpose: "login",
      expires_at,
      login_attempt_id: loginAttempt.login_attempt_id,
    }, { transaction: t });

    const sent = await sendOtpEmail(admin.email, otp, "login");
    if (!sent) {
      await t.rollback();
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    await t.commit();
    return res.status(200).json({
      message: "OTP sent for login verification.",
      admin_id: admin.admin_id,
      admin_email: admin.email,
      attempt_id: loginAttempt.login_attempt_id,
    });
  } catch (err) {
    await t.rollback();
    console.error("Admin Login error:", err);
    return res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getLoginAttempts = async (req, res) => {
  try {
    const admin = req.user;

    if (!admin) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { page = 1, limit = 5 } = req.query;
    const offset = (page - 1) * limit;

    const { rows, count } = await LoginAttempt.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
      include: [
        {
          model: Admin,
          as: 'requestingAdmin',
          attributes: ['admin_id', 'full_name', 'email'],
          foreignKey: 'admin_id'
        },
        {
          model: Admin,
          as: 'approverAdmin',
          attributes: ['admin_id', 'full_name', 'email'],
          foreignKey: 'approved_by'
        }
      ]
    });

    
    const formattedRows = rows.map(attempt => ({
      login_attempt_id: attempt.login_attempt_id,
      admin_id: attempt.admin_id,
      adminName: attempt.requestingAdmin?.full_name || 'Unknown',
      email: attempt.email,
      device: attempt.device || 'Unknown',
      ip_address: attempt.ip_address,
      status: attempt.status,
      approved_by_id: attempt.approved_by,
      approvedByName: attempt.approverAdmin?.full_name || null,
      approved_at: attempt.approved_at,
      rejected_reason: attempt.rejected_reason,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt
    }));

    return res.status(200).json({
      data: formattedRows,
      pagination: {
        page: Number(page),
        totalPages: Math.ceil(count / limit),
        total: count,
      },
    });
  } catch (err) {
    console.error("getLoginAttempts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.approveLoginAttempt = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const admin = req.user;

    if (!admin) {
      await t.rollback();
      return res.status(401).json({ message: "Authentication required." });
    }

    if (admin.role !== "Super Admin") {
      await t.rollback();
      return res.status(403).json({ 
        message: "Only Super Admins can approve login attempts.",
        requiredRole: "Super Admin",
        yourRole: admin.role
      });
    }

    const attempt = await LoginAttempt.findByPk(id, { transaction: t });
    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ message: "Login attempt not found" });
    }

    if (attempt.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ message: "Already processed" });
    }

    
    await attempt.update({
      status: "approved",
      approved_by: admin.admin_id,
      approved_at: new Date(),
    }, { transaction: t });

   
    const requestingAdmin = await Admin.findOne({
      where: { admin_id: attempt.admin_id },
      include: [{ model: Role }],
      transaction: t
    });

    if (!requestingAdmin) {
      await t.rollback();
      return res.status(404).json({ message: "Requesting admin not found." });
    }

   
    const otp = generateOTP(6);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      entity_id: attempt.admin_id,
      entity_type: "Admin",
      otp,
      purpose: "login_approved",
      expires_at,
      login_attempt_id: attempt.login_attempt_id
    }, { transaction: t });

    
    const approvalEmail = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #28a745;">✅ Login Approved</h2>
        <p>Hi ${requestingAdmin.full_name},</p>
        <p>Your login attempt from <strong>${attempt.ip_address}</strong> has been <strong>approved</strong> by <strong>${admin.full_name}</strong> (Super Admin).</p>
        <h3 style="color: #007bff;">Your One-Time Password (OTP):</h3>
        <p style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 2px;">${otp}</p>
        <p style="color: #dc3545;"><strong>⏱️ This OTP is valid for 10 minutes only.</strong></p>
        <p>Device: ${attempt.device || "Unknown"}</p>
        <p>IP Address: ${attempt.ip_address}</p>
        <hr>
        <p style="color: #999; font-size: 12px;">If you did not request this login, please contact your administrator immediately.</p>
      </div>
    `;

    await sendNotificationEmail(
      requestingAdmin.email,
      "✅ Login Approved - Use Your OTP",
      approvalEmail
    );

    await t.commit();

    return res.status(200).json({
      message: "Login approved successfully. OTP sent to admin.",
      admin_email: requestingAdmin.email,
      attempt_id: attempt.login_attempt_id,
      approved_by: admin.full_name
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ approveLoginAttempt error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.rejectLoginAttempt = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const admin = req.user;

    if (!admin) {
      await t.rollback();
      return res.status(401).json({ message: "Authentication required." });
    }

    if (admin.role !== "Super Admin") {
      await t.rollback();
      return res.status(403).json({ 
        message: "Only Super Admins can reject login attempts.",
        requiredRole: "Super Admin",
        yourRole: admin.role
      });
    }

    const attempt = await LoginAttempt.findByPk(id, { transaction: t });
    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ message: "Login attempt not found" });
    }

    if (attempt.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ message: "Already processed" });
    }

   
    await attempt.update({
      status: "rejected",
      approved_by: admin.admin_id,
      approved_at: new Date(),
      rejected_reason: reason || null,
    }, { transaction: t });

  
    const requestingAdmin = await Admin.findOne({
      where: { admin_id: attempt.admin_id },
      transaction: t
    });

    if (!requestingAdmin) {
      await t.rollback();
      return res.status(404).json({ message: "Requesting admin not found." });
    }

   
    const rejectionEmail = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #dc3545;">❌ Login Rejected</h2>
        <p>Hi ${requestingAdmin.full_name},</p>
        <p>Your login attempt from <strong>${attempt.ip_address}</strong> on device <strong>${attempt.device || "Unknown"}</strong> has been <strong>rejected</strong> by <strong>${admin.full_name}</strong> (Super Admin).</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p style="color: #dc3545; font-weight: bold;">⚠️ If this was not you, please contact your administrator immediately.</p>
        <p style="color: #999; font-size: 12px;">You can try logging in again with a different device or contact support.</p>
      </div>
    `;

    await sendNotificationEmail(
      requestingAdmin.email,
      "❌ Login Rejected",
      rejectionEmail
    );

    await t.commit();

    return res.status(200).json({
      message: "Login rejected. Notification sent to admin.",
      attempt_id: attempt.login_attempt_id,
      rejected_by: admin.full_name
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ rejectLoginAttempt error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.verifyApprovedLoginOtp = async (req, res) => {
  if (!validateInput(["admin_id", "otp", "login_attempt_id"], req, res)) return;

  if (!rateLimit(req.body.admin_id + ":verifyApprovedLoginOtp")) {
    return res.status(429).json({ message: "Too many attempts, try again later." });
  }

  const t = await sequelize.transaction();
  try {
    const { admin_id, otp, login_attempt_id } = req.body;

   
    const attempt = await LoginAttempt.findByPk(login_attempt_id, { transaction: t });
    if (!attempt || attempt.status !== "approved") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Login attempt was not approved.",
        status: attempt?.status || "not_found"
      });
    }

    
    const admin = await Admin.findOne({
      where: { admin_id },
      include: [
        {
          model: Role,
          attributes: ["roles_id", "role_name","permissions"],
        },
      ],
      transaction: t,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

 
    if (admin.admin_id !== attempt.admin_id) {
      await t.rollback();
      return res.status(403).json({ message: "This OTP was not issued for your account." });
    }

   
    const record = await OTP.findOne({
      where: {
        entity_id: admin_id,
        purpose: "login_approved",
        login_attempt_id,
        is_used: false
      },
      order: [['created_at', 'DESC']],
      transaction: t
    });

    if (!record) {
      await t.rollback();
      return res.status(400).json({ message: "No OTP found for this approved attempt." });
    }

     if (record.is_used) {
      await t.rollback();
      return res.status(400).json({ message: "OTP already used. Request a new one." });
    }

   
    if (new Date() > record.expires_at) {
      await record.destroy({ transaction: t });
      await t.commit();
      return res.status(400).json({ message: "OTP expired. Please request a new login." });
    }

if (record.attempts >= record.max_attempts) {
      await record.destroy({ transaction: t });
      await t.commit();
      return res.status(400).json({ 
        message: "Maximum OTP verification attempts exceeded." 
      });
    }

   
    if (record.otp !== otp) {
      await record.increment('attempts', { transaction: t });
      
      const remainingAttempts = record.max_attempts - record.attempts - 1;
      await t.commit();
      
      return res.status(400).json({ 
        message: "Invalid OTP.",
        remainingAttempts: Math.max(0, remainingAttempts),
        attemptsExceeded: remainingAttempts <= 0
      });
    }

   
    await record.update(
      { 
        is_used: true,
        verified_at: new Date(),
        attempts: record.attempts + 1
      }, 
      { transaction: t }
    );
    
    await attempt.update({ status: "completed" }, { transaction: t });

    
    const token = generateTokenMainToken({
      admin_id: admin.admin_id,
      email: admin.email,
      full_name: admin.full_name,
      username: admin.username || null,
      role: admin.Role ? admin.Role.role_name : null,
      permissions: admin.Role ? admin.Role.permissions : [],
    });

    
    await admin.update(
      {
        login_success_count: (admin.login_success_count || 0) + 1,
        last_login: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(200).json({
      message: "✅ Login successful.",
      token,
      admin: {
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.Role ? {
          id: admin.Role.roles_id,
          name: admin.Role.role_name,
          description: admin.Role.description,
          permissions: admin.Role.permissions,
        } : null,
      },
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ verifyApprovedLoginOtp error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.resendAdminOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) return res.status(400).json({ message: 'Email and purpose required.' });

    if (purpose === "login_approved" && !req.body.login_attempt_id) {
  return res.status(400).json({ message: "login_attempt_id required" });
}

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: 'admin not found.' });

    await OTP.update(
  { is_used: true },
  {
    where: {
      entity_id: admin.admin_id,
      purpose,
      is_used: false,
      ...(purpose === 'login_approved'
        ? { login_attempt_id: req.body.login_attempt_id }
        : {}),
    },
  }
);
    

    const otp = generateOTP(6);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.create({
  entity_id: admin.admin_id,
  entity_type: 'Admin',
  otp,
  purpose,
  expires_at,
  login_attempt_id: purpose === 'login_approved'
    ? req.body.login_attempt_id
    : null,
});


    const sent = await sendOtpEmail(admin.email, otp, purpose);
    if (!sent) return res.status(500).json({ message: 'Failed to send OTP email.' });

    return res.status(200).json({ message: 'OTP resent successfully.', admin_id: admin.admin_id });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ message: 'Server error.', error: err });
  }
};


exports.verifyAdminOtp = async (req, res) => {
  if (!validateInput(["admin_id", "otp", "purpose"], req, res)) return;

  if (!rateLimit(req.body.admin_id + ":verifyOTP")) {
    return res.status(429).json({ message: "Too many attempts, try again later." });
  }

  const t = await sequelize.transaction();
  try {
    const { admin_id, otp, purpose } = req.body;

    const admin = await Admin.findOne({
      where: { admin_id },
      include: [
        {
          model: Role,
          attributes: ["roles_id", "role_name", "permissions"],
        },
      ],
      transaction: t,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

    const record = await OTP.findOne({
      where: { entity_id: admin_id, purpose, is_used: false },
      order: [['created_at', 'DESC']],
      transaction: t
    });

    if (!record) {
      await t.rollback();
      return res.status(400).json({ message: "No OTP found." });
    }

    if (record.is_used) {
      await t.rollback();
      return res.status(400).json({ message: "OTP already used. Request a new one." });
    }

    if (new Date() > record.expires_at) {
      await record.destroy({ transaction: t });
      await t.commit();
      return res.status(400).json({ message: "OTP expired." });
    }

    if (record.attempts >= record.max_attempts) {
      await record.destroy({ transaction: t });
      await t.commit();
      return res.status(400).json({
        message: "Maximum OTP verification attempts exceeded. Request a new OTP."
      });
    }

    const storedOtp = String(record.otp).trim();
    const providedOtp = String(otp).trim();

    console.log('🔍 OTP Verification Debug:', {
      stored: `"${storedOtp}"`,
      provided: `"${providedOtp}"`,
      match: storedOtp === providedOtp,
      storedType: typeof record.otp,
      providedType: typeof otp
    });

    if (storedOtp !== providedOtp) {
      await record.increment('attempts', { transaction: t });

      const remainingAttempts = record.max_attempts - (record.attempts + 1);
      await t.commit();

      return res.status(400).json({
        message: "Invalid OTP.",
        remainingAttempts: Math.max(0, remainingAttempts),
        attemptsExceeded: remainingAttempts <= 0
      });
    }

    await record.update(
      {
        is_used: true,
        verified_at: new Date(),
        attempts: record.attempts + 1
      },
      { transaction: t }
    );

    if (record.login_attempt_id) {
      await LoginAttempt.update(
        { status: "completed" },
        { where: { login_attempt_id: record.login_attempt_id }, transaction: t }
      );
    }

    let token;

    if (purpose === "register") {
      await admin.update({ isVerified: true }, { transaction: t });

      if (admin.admin_role) {
        await Role.increment("role_count", {
          by: 1,
          where: { roles_id: admin.admin_role },
          transaction: t,
        });
      }

       if (admin.Role?.role_name === "Super Admin") {
    const settings = await Settings.findOne({ transaction: t });

    if (settings && !settings.owner_email) {
      const { firstName, lastName } = splitFullName(admin.full_name);

      await settings.update(
        {
          owner_first_name: firstName,
          owner_last_name: lastName,
          owner_email: admin.email,
          created_by: admin.admin_id,
        },
        { transaction: t }
      );
    }
  }

      token = generateToken({
        admin_id: admin.admin_id,
        email: admin.email,
        verified: true,
        role: admin.Role ? admin.Role.role_name : null,
      });

      await sendRegisteredAdminEmail(
        admin.email,
        admin.full_name,
        admin.Role ? admin.Role.role_name : null
      );
    } else if (purpose === "login") {
      token = generateTokenMainToken({
        admin_id: admin.admin_id,
        email: admin.email,
        role: admin.Role ? admin.Role.role_name : null,
        permissions: admin.Role ? admin.Role.permissions : [],
        full_name: admin.full_name,
        username: admin.username || null,
      });

      await admin.update(
        {
          login_success_count: (admin.login_success_count || 0) + 1,
          last_login: new Date(),
        },
        { transaction: t }
      );
    } else if (purpose === "reset_password") {
      token = generateToken({
        admin_id: admin.admin_id,
        email: admin.email,
        reset: true
      });
    } else {
      await t.rollback();
      return res.status(400).json({ message: "Invalid purpose." });
    }

    await t.commit();

    return res.status(200).json({
      message: "OTP verified.",
      token,
      admin: {
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.Role
          ? {
              id: admin.Role.roles_id,
              name: admin.Role.role_name,
              permissions: admin.Role.permissions,
            }
          : null,
      },
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ verifyAdminOtp error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


exports.forgotAdminPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: 'admin not found.' });


     if (admin.role !== 'Super Admin') {
      return res.status(403).json({
        message: 'Password reset is only allowed for super admins.',
      });
    }

    if (!admin.isVerified) {
      return res.status(403).json({ message: "Please verify your account head to register or sign up to verify." });
    }

    const otp = generateOTP(6);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      entity_id: admin.admin_id,
      entity_type: 'Admin',
      otp,
      purpose: 'reset_password',
      expires_at,
    });

    const sent = await sendOtpEmail(admin.email, otp, 'reset_password');
    if (!sent) return res.status(500).json({ message: 'Failed to send OTP email.' });

    return res.status(200).json({ message: 'Password reset OTP sent.', admin_id: admin.admin_id });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Server error.', error: err });
  }
};

exports.resetAdminPassword = async (req, res) => {
  try {
    const { admin_id, new_password } = req.body;
    if (!admin_id || !new_password) {
      return res.status(400).json({ message: 'admin_id and new_password are required.' });
    }

    const admin = await Admin.findOne({ where: { admin_id } });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    if (admin.role !== 'Super Admin') {
      return res.status(403).json({
        message: 'Password reset is only allowed for super admins.',
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await admin.update({ password: hashedPassword });

     await OTP.update(
      { is_used: true, verified_at: new Date() },
      {
        where: {
          entity_id: admin_id,
          purpose: 'reset_password',
          is_used: false,
        },
      }
    );

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    return res.status(500).json({ message: 'Server error.', error: err });
  }
};

exports.addAdmin = async (req, res) => {
  const t = await sequelize.transaction();

  try {

    const admin_id = req.user?.admin_id;

    const { 
      full_name,
      email,
      admin_role,
      phone,
      address,
      state,
      username,
      password
    } = req.body;

   
    const actingAdmin = await Admin.findOne({
      where: { admin_id, isVerified: true },
      transaction: t,
    });

    if (!actingAdmin) {
      await t.rollback();
      return res.status(403).json({
        message: "Only verified admins can add new admins.",
      });
    }

   
    if (!rateLimit(email + ":addAdmin")) {
      await t.rollback();
      return res.status(429).json({
        message: "Too many attempts, try again later.",
      });
    }

    
    if (!full_name || !email || !admin_role || !password) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Full name, email, and admin role are required." });
    }

   
    const existingAdmin = await Admin.findOne({ where: { email }, transaction: t });
    if (existingAdmin) {
      await t.rollback();
      return res.status(400).json({ message: "Admin with this email already exists." });
    }

      const existingAdminUsername = await Admin.findOne({ where: { username }, transaction: t });
    if (existingAdminUsername) {
      await t.rollback();
      return res.status(400).json({ message: "Admin with this username already exists." });
    }

   
    const role = await Role.findOne({ where: { roles_id: admin_role }, transaction: t });
    if (!role) {
      await t.rollback();
      return res.status(404).json({ message: "Invalid admin role provided." });
    }

    
    const plainPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

   
    const newAdmin = await Admin.create(
      {
        full_name,
        email,
        password: hashedPassword,
        admin_role,
        phone,
        address,
        state,
        username,
        isVerified: true,
      },
      { transaction: t }
    );

   
    await Role.increment("role_count", {
      by: 1,
      where: { roles_id: admin_role },
      transaction: t,
    });

    
    const emailSent = await sendNewAdminEmail(email, full_name, plainPassword, role.role_name);
    if (!emailSent) {
      await t.rollback();
      return res.status(500).json({ message: "Failed to send admin credentials email." });
    }

    await t.commit();
    return res.status(201).json({
      message: "Admin added successfully and credentials sent via email.",
      admin_id: newAdmin.admin_id,
    });
  } catch (error) {
    await t.rollback();
    console.error("❌ addAdmin error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      include: [
        {
          model: Role,
          attributes: ["roles_id", "role_name", "permissions"],
          where: {
            role_name: {
              [Op.ne]: "DEVELOPER",
            },
          },
          required: true,
        },
      ],
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({ admins });
  } catch (error) {
    console.error("❌ getAdmins error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.getMiniAdminData = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ["admin_id", "full_name", "email"],
      include: [
        {
          model: Role,
          attributes: [],
        where: {
            role_name: {
              [Op.notIn]: ["Super Admin", "DEVELOPER"],
            },
          },
          required: true,
        },
      ],
    });

    return res.status(200).json({ admins });
  } catch (error) {
    console.error("❌ getMiniAdminData error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.getAdminById = async (req, res) => {
  try {
    const { admin_id } = req.params;
    const admin = await Admin.findOne({
      where: { admin_id },
      include: [
        {
          model: Role,
          attributes: ["roles_id", "role_name","permissions"],
        },
      ],
      attributes: { exclude: ["password"] }, 
    });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }
    return res.status(200).json({ admin });
  } catch (error) {
    console.error("❌ getAdminById error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
}

exports.updateAdmin = async (req, res) => {
  const t = await sequelize.transaction();
  try {
      const admin_id = req.user?.admin_id;
    const {
      full_name,
      username,
      phone,
      email,
      address,
      state,
      admin_role,
    } = req.body;

    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

    
    if (admin_role) {
      const role = await Role.findOne({ where: { roles_id: admin_role }, transaction: t });
      if (!role) {
        await t.rollback();
        return res.status(404).json({ message: "Invalid admin role provided." });
      }
      if (admin.admin_role !== admin_role) {
        await Role.increment("role_count", { by: 1, where: { roles_id: admin_role }, transaction: t });
        await Role.decrement("role_count", { by: 1, where: { roles_id: admin.admin_role }, transaction: t });
        admin.admin_role = admin_role;
      }

    }


 
    if (full_name) admin.full_name = full_name;
        if (email) {
     const existingAdmin = await Admin.findOne({
        where: { email, admin_id: { [Op.ne]: admin_id } },
        transaction: t
      });

    if (existingAdmin) {
      await t.rollback();
      return res.status(400).json({ message: "Email already exists." });
    }


      admin.email = email;
    }
    if (phone) admin.phone = phone;
    if (address) admin.address = address;
    if (state) admin.state = state;

    if (username) {
      const existingAdminUsername = await Admin.findOne({
        where: {username, admin_id: { [Op.ne]: admin_id}},
        transaction: t
      });

      if (existingAdminUsername) {
      await t.rollback();
      return res.status(400).json({ message: "Username already exists." });
    }


      admin.username = username;
    }

    await admin.save({ transaction: t });
    await t.commit();

    return res.status(200).json({ message: "Admin updated successfully.", admin });
  } catch (error) {
    await t.rollback();
    console.error("❌ updateAdmin error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.changeAdminPassword = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const admin_id = req.user?.admin_id;
    if (!admin_id) return res.status(401).json({ message: "Unauthorized" });

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new passwords are required." });
    }

    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) return res.status(404).json({ message: "Admin not found." });

    
    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) return res.status(403).json({ message: "Old password is incorrect." });

    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;

    await admin.save({ transaction: t });
    await t.commit();

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    await t.rollback();
    console.error("❌ changeAdminPassword error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.updateAdminById = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admin_id } = req.body;
    
    if (!admin_id) {
      await t.rollback();
      return res.status(400).json({ message: "admin_id is required." });
    }

    const {
      full_name,
      username,
      phone,
      email,
      address,
      state,
      admin_role,
    } = req.body;

    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

    if (admin_role) {
      const role = await Role.findOne({ where: { roles_id: admin_role }, transaction: t });
      if (!role) {
        await t.rollback();
        return res.status(404).json({ message: "Invalid admin role provided." });
      }
      if (admin.admin_role !== admin_role) {
        await Role.increment("role_count", { by: 1, where: { roles_id: admin_role }, transaction: t });
        await Role.decrement("role_count", { by: 1, where: { roles_id: admin.admin_role }, transaction: t });
        admin.admin_role = admin_role;
      }
    }

    if (full_name) admin.full_name = full_name;
    
    if (email) {
      const existingAdmin = await Admin.findOne({
        where: { email, admin_id: { [Op.ne]: admin_id } },
        transaction: t
      });
      if (existingAdmin) {
        await t.rollback();
        return res.status(400).json({ message: "Email already exists." });
      }
      admin.email = email;
    }
    
    if (phone) admin.phone = phone;
    if (address) admin.address = address;
    if (state) admin.state = state;

    if (username) {
      const existingAdminUsername = await Admin.findOne({
        where: { username, admin_id: { [Op.ne]: admin_id } },
        transaction: t
      });
      if (existingAdminUsername) {
        await t.rollback();
        return res.status(400).json({ message: "Username already exists." });
      }
      admin.username = username;
    }

    await admin.save({ transaction: t });
    await t.commit();

    return res.status(200).json({ message: "Admin updated successfully.", admin });
  } catch (error) {
    await t.rollback();
    console.error("❌ updateAdminById error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.changeAdminPasswordById = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admin_id, newPassword } = req.body;

    if (!admin_id) {
      await t.rollback();
      return res.status(400).json({ message: "admin_id is required." });
    }

  if (!newPassword) {
  await t.rollback();
  return res.status(400).json({ message: "New password is required." });
}

    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      await t.rollback();
      return res.status(403).json({ message: "Old password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;

    await admin.save({ transaction: t });
    await t.commit();

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    await t.rollback();
    console.error("❌ changeAdminPasswordById error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.deleteAdmin = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admin_id } = req.params;
    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }
    await admin.destroy({ transaction: t });
    await Role.decrement("role_count", {
      by: 1,
      where: { roles_id: admin.admin_role },
      transaction: t,
    });
    await t.commit();
    return res.status(200).json({ message: "Admin deleted successfully." });
  } catch (error) {
    await t.rollback();
    console.error("❌ deleteAdmin error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  } 
};