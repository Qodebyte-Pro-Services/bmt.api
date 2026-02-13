const { Attribute, AttributeValue } = require("../models");

exports.createAttribute = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
    }
    try {
       
        const existing = await Attribute.findOne({
            where: { name: name.toLowerCase() }
        });
        if (existing) {
            return res.status(409).json({ message: 'Attribute with this name already exists.' });
        }
        const attribute = await Attribute.create({ name: name.toLowerCase() });
        res.status(201).json(attribute);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}




exports.createAttributesBulk = async (req, res) => {
  const { attributes } = req.body;

  if ( !Array.isArray(attributes)) {
    return res.status(400).json({ message: ' attributes array are required.' });
  }

  try {
    const createdAttributes = [];

    for (const attr of attributes) {
      const { name, values } = attr;
 
      const existing = await Attribute.findOne({
        where: { name: name.toLowerCase() }
      });
      if (existing) {
        createdAttributes.push({ name, status: 'exists' });
        continue;
      }

      const attribute = await Attribute.create({ name: name.toLowerCase() });
      const addedValues = [];
      if (Array.isArray(values)) {
        for (const value of values) {

          const valueExists = await AttributeValue.findOne({
            where: { attribute_id: attribute.id, value: value.toLowerCase() }
          });
          if (!valueExists) {
            const valueObj = await AttributeValue.create({ attribute_id: attribute.id, value: value.toLowerCase() });
            addedValues.push(valueObj);
          }
        }
      }
      createdAttributes.push({ attribute, values: addedValues });
    }
    return res.status(201).json({
      message: 'Attributes processed.',
      data: createdAttributes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};


exports.getAllAttributes = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { count, rows } = await Attribute.findAndCountAll({
      include: [{ model: AttributeValue, as: 'values' }],
      offset: Number(offset),
      limit: Number(limit),
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({
      attributes: rows,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.getAttributeAndValuesById = async (req, res) => {
    const { id } = req.params;
    try {
        const attribute = await Attribute.findByPk(id, {
            include: [{ model: AttributeValue, as: 'values' }]
        });
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
        res.status(200).json(attribute);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

exports.addAttributeValue = async (req, res) => {
    const { id } = req.params;
    const { value } = req.body;
    if (!value) {
        return res.status(400).json({ message: 'Value is required.' });
    }
    try {
        const attribute = await Attribute.findByPk(id);
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
   
        const valueExists = await AttributeValue.findOne({
            where: { attribute_id: attribute.id, value: value.toLowerCase() }
        });
        if (valueExists) {
            return res.status(409).json({ message: 'Value already exists for this attribute.' });
        }
        const attributeValue = await AttributeValue.create({
            attribute_id: attribute.id,
            value: value.toLowerCase()
        });
        res.status(201).json(attributeValue);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

exports.updateAttribute = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
    }
    try {
        const attribute = await Attribute.findByPk(id);
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
      
        const nameExists = await Attribute.findOne({
            where: { name: name.toLowerCase(), id: { [Op.ne]: id } }
        });
        if (nameExists) {
            return res.status(409).json({ message: 'Another attribute with this name already exists.' });
        }
        attribute.name = name.toLowerCase();
        await attribute.save();
        res.status(200).json(attribute);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

exports.UpdateAttributeValue = async (req, res) => {
    const { id, value_id } = req.params;
    const { value } = req.body;
    if (!value) {
        return res.status(400).json({ message: 'Value is required.' });
    }
    try {
        const attribute = await Attribute.findByPk(id);
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
        const attributeValue = await AttributeValue.findOne({
            where: { id: value_id, attribute_id: id }
        });
        if (!attributeValue) {
            return res.status(404).json({ message: 'Attribute value not found.' });
        }
       
        const valueExists = await AttributeValue.findOne({
            where: { attribute_id: id, value: value.toLowerCase(), id: { [Op.ne]: value_id } }
        });
        if (valueExists) {
            return res.status(409).json({ message: 'Another value with this name already exists for this attribute.' });
        }
        attributeValue.value = value.toLowerCase();
        await attributeValue.save();    
        res.status(200).json(attributeValue);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

exports.deleteAttribute = async (req, res) => {
    const { id } = req.params;
    try {
        const attribute = await Attribute.findByPk(id, {
            include: [{ model: AttributeValue, as: 'values' }]
        });
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
    
        if (attribute.values && attribute.values.length > 0) {
            for (const value of attribute.values) {
                await value.destroy();
            }
        }
        await attribute.destroy();
        res.status(200).json({ message: 'Attribute and its values deleted successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

exports.deleteAttributeValue = async (req, res) => {
    const { id, value_id } = req.params;
    try {
        const attribute = await Attribute.findByPk(id);
        if (!attribute) {
            return res.status(404).json({ message: 'Attribute not found.' });
        }
        const attributeValue = await AttributeValue.findOne({
            where: { id: value_id, attribute_id: id }
        });

        if (!attributeValue) {
            return res.status(404).json({ message: 'Attribute value not found.' });
        }
        await attributeValue.destroy();
        res.status(200).json({ message: 'Attribute value deleted successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }   
}