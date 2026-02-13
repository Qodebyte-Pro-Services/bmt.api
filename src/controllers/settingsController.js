const { Settings } = require("../models");
const fs = require("fs");
const path = require("path");


exports.updateSettings = async (req, res) => {
  try {
    const { admin_id, role } = req.user;
    if (role !== 'Super Admin') {
      return res.status(403).json({ message: 'Only Super Admin can update settings.' });
    }

    const { site_name, removeLogo, owner_first_name, owner_last_name, owner_email, company_email, company_phone, company_address } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({ site_name: site_name || "My Marketplace", created_by: admin_id });
    }

    if (site_name) settings.site_name = site_name;

    if (owner_email) settings.owner_email = owner_email;

    if (owner_first_name) settings.owner_first_name = owner_first_name;

    if (owner_last_name) settings.owner_last_name = owner_last_name;

    if (company_address) settings.company_address = company_address;

    if (company_email) settings.company_email = company_email;
     
    if (company_phone) settings.company_phone = company_phone;

    if (req.file) {
      
      if (settings.site_logo) {
        const oldFilePath = path.join(__dirname, '../../', settings.site_logo);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      
      settings.site_logo = `/uploads/${fileName}`;
    } else if (removeLogo === "true" || removeLogo === true) {
      if (settings.site_logo) {
        const oldFilePath = path.join(__dirname, '../../', settings.site_logo);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
        settings.site_logo = null;
      }
    }

    settings.updated_by = admin_id;
    await settings.save();

    return res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    console.error('❌ updateSettings error:', error);
    return res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            return res.status(404).json({ message: 'Settings not found' });
        }
        return res.status(200).json({ settings });

    } catch (error) {
       console.error('❌ getSettings error:', error);
       return res.status(500).json({ message: 'Internal server error', error });
    }
}