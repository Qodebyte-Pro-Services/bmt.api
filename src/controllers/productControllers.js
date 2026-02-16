
const { Category, Product, Variant, InventoryLog, Attribute, AttributeValue, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const generateUniqueBarcode = async (transaction) => {
  let barcode;
  let exists = true;
  
  while (exists) {
   
    barcode = `PRD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2,6).toUpperCase()}
`;
    
    const found = await Variant.findOne({
      where: { barcode },
      transaction
    });
    exists = !!found;
  }
  
  return barcode;
};


exports.createProduct = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { category_id, name, brand, description, base_sku, taxable, threshold, unit, hasVariation } = req.body;


    if (!category_id || !name || !description || !brand) {
      await transaction.rollback();
      return res.status(400).json({ message: "category_id, description, brand and name are required." });
    }

   
    const category = await Category.findOne({ where: { id: category_id }, transaction });
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({ message: "Category not found." });
    }


    const existingProduct = await Product.findOne({
      where: { name: name.toLowerCase() },
      transaction
    });
    if (existingProduct) {
      await transaction.rollback();
      return res.status(409).json({ message: "Product name already exists." });
    }


   const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    
    const saveFilesToUploads = (files) => {
      return files.map(file => {
        const fileName = `product-${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return {
          filename: fileName,
          url: `/uploads/${fileName}`
        };
      });
    };

    
     const mainImageFile = req.files?.product_main_image?.[0];
    const additionalImageFiles = req.files?.product_additional_image_ || [];

    let productImages = [];
    if (mainImageFile) {
      productImages.push(...saveFilesToUploads([mainImageFile]));
    }
    if (additionalImageFiles.length > 0) {
      productImages.push(...saveFilesToUploads(additionalImageFiles));
    }

   
    productImages = productImages.filter(
      (img, i, self) => i === self.findIndex(x => x.filename === img.filename)
    );

    const product = await Product.create({
      category_id: category.id,
      name: name.toLowerCase(),
      brand,
      description,
      base_sku,
      image_url: productImages,
      taxable: !!taxable,
      threshold,
      unit,
      hasVariation: !!hasVariation
    }, { transaction });

    await transaction.commit();
    return res.status(201).json({ message: "Product created successfully", product });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Error creating product', error: error.message });
  }
};

exports.createProductWithVariants = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      category_id,
      name,
      brand,
      description,
      base_sku,
      taxable,
      threshold,
      unit,
      hasVariation,
      attributes = [],
      variants = []
    } = req.body;

    const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
    const parsedAttributes = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;

    const category = await Category.findOne({ where: { id: category_id }, transaction });
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({ message: "Category not found." });
    }

    if (!category_id || !name || !description || !brand) {
      await transaction.rollback();
      return res.status(400).json({ message: "category_id, description, brand and name are required." });
    }

    const existingProduct = await Product.findOne({
      where: { name: name.toLowerCase() },
      transaction
    });
    if (existingProduct) {
      await transaction.rollback();
      return res.status(409).json({ message: "Product name already exists." });
    }

 
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    
    const saveFilesToUploads = (files) => {
      return files.map(file => {
        const fileName = `product-${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return {
          filename: fileName,
          url: `/uploads/${fileName}`
        };
      });
    };

    
       const mainImageFile = req.files?.product_main_image?.[0];
      const additionalImageFiles = req.files?.product_additional_image_ || [];


    let productImages = [];
    if (mainImageFile) {
      productImages.push(...saveFilesToUploads([mainImageFile]));
    }
    if (additionalImageFiles.length > 0) {
      productImages.push(...saveFilesToUploads(additionalImageFiles));
    }

   
    productImages = productImages.filter(
      (img, i, self) => i === self.findIndex(x => x.filename === img.filename)
    );

    const product = await Product.create({
      category_id: category.id,
      name: name.toLowerCase(),
      brand,
      description,
      base_sku,
      image_url: productImages,
      taxable: !!taxable,
      threshold: (threshold && !isNaN(Number(threshold))) ? Number(threshold) : null,
      unit,
      hasVariation: !!hasVariation
    }, { transaction });

    const ensureAttributeAndValues = async (attr) => {
      let attribute = await Attribute.findOne({ where: { name: attr.name.toLowerCase() }, transaction });
      if (!attribute) {
        attribute = await Attribute.create({ name: attr.name.toLowerCase() }, { transaction });
      }
      let valueIds = [];
      for (const val of attr.values) {
        let value = await AttributeValue.findOne({
          where: { attribute_id: attribute.id, value: val.toLowerCase() },
          transaction
        });
        if (!value) {
          value = await AttributeValue.create({ attribute_id: attribute.id, value: val.toLowerCase() }, { transaction });
        }
        valueIds.push({
          attribute_id: attribute.id,
          value_id: value.id,
          name: attribute.name,
          value: value.value
        });
      }
      return valueIds;
    };

    let attributeMatrix = [];
    for (const attr of parsedAttributes) {
      const vals = await ensureAttributeAndValues(attr);
      attributeMatrix.push({ name: attr.name, values: vals });
    }

    const cartesian = (arr) => arr.reduce(
      (a, b) => a.flatMap(d => b.values.map(e => d.concat([e]))),
      [[]]
    );

    let finalVariants = [];
    if (!parsedVariants.length && attributeMatrix.length) {
      const combos = cartesian(attributeMatrix);
      finalVariants = combos.map((combo, idx) => {
        const attrObj = {};
        combo.forEach(c => attrObj[c.name] = c.value);
        return {
          attributes: attrObj,
          sku: base_sku ? `${base_sku}-${idx + 1}` : `${name.replace(/\s+/g, "").toUpperCase()}-${idx + 1}`,
          cost_price: 0,
          selling_price: 0,
          quantity: 0,
          barcode: null
        };
      });
    } else {
      finalVariants = parsedVariants;
    }

    let createdVariants = [];
    let inventoryLogs = [];

    for (let i = 0; i < finalVariants.length; i++) {
      const v = finalVariants[i];

      const skuCheck = await Variant.findOne({ where: { sku: v.sku }, transaction });
      if (skuCheck) {
        await transaction.rollback();
        return res.status(409).json({ message: `SKU ${v.sku} already exists.` });
      }

            if (v.barcode) {
        const barcodeCheck = await Variant.findOne({ 
          where: { barcode: v.barcode }, 
          transaction 
        });
        if (barcodeCheck) {
          await transaction.rollback();
          return res.status(409).json({ 
            message: `Barcode ${v.barcode} already exists.`,
            variant_sku: barcodeCheck.sku
          });
        }
      }

      let attrArr = [];
      for (const [attrName, val] of Object.entries(v.attributes || {})) {
        const attr = attributeMatrix.find(a => a.name === attrName);
        if (attr) {
          const valObj = attr.values.find(x => x.value === val);
          if (valObj) {
            attrArr.push({
              attribute_id: valObj.attribute_id,
              value_id: valObj.value_id,
              name: attrName,
              value: val
            });
          }
        }
      }

  
     const fileKey = `variants[${i}][image_url]`;
      const variantFiles = req.files?.[fileKey] || [];
      let variantImages = [];
      
      if (variantFiles.length > 0) {
        variantImages = saveFilesToUploads(variantFiles);
      } else if (v.image_url) {
        variantImages = Array.isArray(v.image_url) ? v.image_url : [v.image_url];
      } else {
        variantImages = [];
      }

      if (parsedVariants.length === 1 && !JSON.parse(hasVariation)) {
        variantImages = productImages;
      }

      
      variantImages = variantImages.filter((img, i, self) => i === self.findIndex(x => x.filename === img.filename));

       const finalBarcode = v.barcode || await generateUniqueBarcode(transaction);

      const variant = await Variant.create({
        product_id: product.id,
        attributes: attrArr,
        cost_price: v.cost_price || 0,
        selling_price: v.selling_price || 0,
        quantity: v.quantity || 0,
        threshold: v.threshold ?? 0,
        sku: v.sku,
        image_url: variantImages,
        expiry_date: null,
        is_active: true,
        barcode: finalBarcode
      }, { transaction });

      createdVariants.push(variant);

      if (variant.quantity > 0) {
        inventoryLogs.push({
          variant_id: variant.id,
          type: 'restock',
          quantity: variant.quantity,
          reason: 'increase',
          note: 'Initial stock on variant creation',
          recorded_by: req.user.admin_id,
          recorded_by_type: 'admin'
        });
      }
    }

    if (inventoryLogs.length > 0) {
      await InventoryLog.bulkCreate(inventoryLogs, { transaction });
    }

    await transaction.commit();
     return res.status(201).json({
      message: "Product with variants created.",
      product: {
        ...product.toJSON(),
        barcode_info: {
          auto_generated: true
        }
      },
      variants: createdVariants.map(v => ({
        ...v.toJSON(),
        barcode_info: {
          barcode: v.barcode,
          auto_generated: !parsedVariants[createdVariants.indexOf(v)]?.barcode
        }
      }))
    });

  } catch (err) {
    await transaction.rollback();
    console.error(err);
    return res.status(500).json({ message: "Server error.", details: err.message });
  }
};


exports.listProducts = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { count, rows } = await Product.findAndCountAll({
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Variant,
          as: 'variants',
          attributes: ['id', 'sku', 'quantity', 'selling_price', 'cost_price', 'threshold', 'image_url', 'barcode']
        }
      ],
      offset: Number(offset),
      limit: Number(limit),
      order: [['created_at', 'DESC']]
    });

    const enrichedProducts = rows.map(product => {
      const productData = product.toJSON();
      const variants = productData.variants || [];

     
      const totalStock = variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);

     
      const basePrice = variants.length > 0
        ? Math.min(...variants.map(v => parseFloat(v.selling_price) || 0))
        : 0;

    
      const inventoryValue = variants.reduce((sum, variant) => {
        return sum + ((variant.quantity || 0) * (parseFloat(variant.selling_price) || 0));
      }, 0);

     
      const combinedThreshold = variants.reduce((sum, variant) => sum + (variant.threshold || 0), 0);

      
      let stockStatus = 'in_stock';
      if (totalStock <= 0) {
        stockStatus = 'out_of_stock';
      } else if (totalStock <= combinedThreshold) {
        stockStatus = 'low_stock';
      }

      return {
        ...productData,
        stock: {
          total_quantity: totalStock,
          status: stockStatus,
          base_price: parseFloat(basePrice.toFixed(2)),
          inventory_value: parseFloat(inventoryValue.toFixed(2)),
          threshold: combinedThreshold
        }
      };
    });

    res.status(200).json({
      products: enrichedProducts,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};


exports.ProductWithVariants = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Variant,
          as: 'variants',
          attributes: ['id', 'sku', 'quantity', 'selling_price', 'cost_price', 'threshold', 'image_url', 'barcode']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Enrich product with stock, pricing, and inventory info
    const productData = product.toJSON();
    const variants = productData.variants || [];

    const totalStock = variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);

    const basePrice = variants.length > 0
      ? Math.min(...variants.map(v => parseFloat(v.selling_price) || 0))
      : 0;

    const inventoryValue = variants.reduce((sum, variant) => {
      return sum + ((variant.quantity || 0) * (parseFloat(variant.selling_price) || 0));
    }, 0);

    const inventoryCost = variants.reduce((sum, variant) => {
      return sum + ((variant.quantity || 0) * (parseFloat(variant.cost_price) || 0));
    }, 0);

    const combinedThreshold = variants.reduce((sum, variant) => sum + (variant.threshold || 0), 0);

    let stockStatus = 'in_stock';
    if (totalStock <= 0) {
      stockStatus = 'out_of_stock';
    } else if (totalStock <= combinedThreshold) {
      stockStatus = 'low_stock';
    }

    const enrichedProduct = {
      ...productData,
      stock: {
        total_quantity: totalStock,
        status: stockStatus,
        base_price: parseFloat(basePrice.toFixed(2)),
        inventory_value: parseFloat(inventoryValue.toFixed(2)),
        inventory_cost: parseFloat(inventoryCost.toFixed(2)), 
        threshold: combinedThreshold,
        variant_count: variants.length
      }
    };

    res.status(200).json(enrichedProduct);
  } catch (error) {
    console.error("Error fetching product with variants:", error);
    res.status(500).json({
      message: "Error fetching product with variants",
      error: error.message,
    });
  }
};




  exports.updateProducts = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      name,
      description,
      brand,
      category_id,
      base_sku,
      taxable,
      threshold,
      unit,
      hasVariation,
      remove_images,
      replace_images
    } = req.body;

    const product = await Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Product not found' });
    }

    if (name) {
      const existing = await Product.findOne({
        where: { name: name.trim(), id: { [Op.ne]: id } },
        transaction
      });
      if (existing) {
        await transaction.rollback();
        return res.status(409).json({ message: 'Product name already exists' });
      }
    }

   
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const saveFilesToUploads = (files) => {
      return files.map(file => {
        const fileName = `product-${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return {
          filename: fileName,
          url: `/uploads/${fileName}`
        };
      });
    };

    let existingImages = Array.isArray(product.image_url) ? [...product.image_url] : [];

  
    const imagesToRemove = remove_images
      ? Array.isArray(remove_images) ? remove_images : [remove_images]
      : [];
    
    for (const filename of imagesToRemove) {
      try {
       
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      
        existingImages = existingImages.filter(img => img.filename !== filename);
      } catch (err) {
        console.error('Error removing image:', err);
      }
    }

    const uploadedFiles = (req.files || []).filter(f => f.fieldname === 'image_url');
    const uploadedImages = uploadedFiles.length > 0
      ? saveFilesToUploads(uploadedFiles)
      : [];

    
    let finalImages = replace_images === 'true' ? uploadedImages : [...existingImages, ...uploadedImages];

    finalImages = finalImages.filter(
      (img, index, self) => index === self.findIndex(i => i.filename === img.filename)
    );

 
    const updatedData = {
      ...(name && { name: name.trim() }),
      ...(description && { description }),
      ...(brand && { brand }),
      ...(category_id && { category_id }),
      ...(base_sku && { base_sku }),
      image_url: finalImages,
      ...(typeof taxable !== 'undefined' && { taxable: !!taxable }),
      ...(threshold !== undefined && { threshold }),
      ...(unit && { unit }),
      ...(typeof hasVariation !== 'undefined' && { hasVariation: !!hasVariation })
    };

    await Product.update(updatedData, { where: { id }, transaction });

    const updatedProduct = await Product.findByPk(id, { transaction });

    await transaction.commit();
    return res.status(200).json(updatedProduct);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};


exports.deleteProduct = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Product not found' });
    }

 
    const variants = await Variant.findAll({ where: { product_id: id }, transaction });

   
     const productImages = Array.isArray(product.image_url) ? product.image_url : [];
    let variantImages = [];
    variants.forEach(v => {
      variantImages.push(...(Array.isArray(v.image_url) ? v.image_url : []));
    });

    const allImages = [...productImages, ...variantImages];

    const variantIds = variants.map(v => v.id);
    if (variantIds.length > 0) {
      await InventoryLog.destroy({ where: { variant_id: variantIds }, transaction });
    }

   
    if (variantIds.length > 0) {
      await Variant.destroy({ where: { id: variantIds }, transaction });
    }

   
    await Product.destroy({ where: { id }, transaction });

   
    await transaction.commit();

   
     const uploadsDir = path.join(__dirname, '../../uploads');
    for (const img of allImages) {
      if (img.filename) {
        try {
          const filePath = path.join(uploadsDir, img.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${img.filename}:`, err);
        }
      }
    }


    res.status(200).json({ message: 'Product, variants, and inventory logs deleted.' });

  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};