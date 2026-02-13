
const { Attribute, AttributeValue, Variant, Product, InventoryLog, Category, CartItem } = require('../models');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

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


exports.generateVariantNames = async (req, res) => {
  try {
    const { product_name, attributes = [], separator = " - ", base_sku } = req.body;

    if (!product_name) {
      return res.status(400).json({ message: 'product_name is required.' });
    }

    if (!attributes.length) {
      const sku = (base_sku || product_name).replace(/\s+/g, '').toUpperCase();
      return res.json({ variants: [{ name: product_name, sku }] });
    }


    const allValues = [];

    for (const attr of attributes) {
      const attrName = typeof attr === "string" ? attr : attr.name;
      const values =
        Array.isArray(attr.values) && attr.values.length > 0
          ? attr.values
          : [];

      if (!values.length) {
        return res.status(400).json({ message: `Attribute "${attrName}" has no values.` });
      }

      allValues.push(values);
    }

    
    const generateCombinations = (arrays, prefix = []) => {
      if (!arrays.length) return [prefix];
      const [first, ...rest] = arrays;
      return first.flatMap(v => generateCombinations(rest, [...prefix, v]));
    };

    const combinations = generateCombinations(allValues);

   
    const variants = combinations.map(combo => {
      const comboName = combo.join(separator.replace(/\s+/g, ''));
      const variantName = `${product_name}${separator}${combo.join('-')}`;
      const sku = `${(base_sku || product_name)
        .replace(/\s+/g, '')
        .toUpperCase()}-${combo.map(v => v.replace(/\s+/g, '').toUpperCase()).join('-')}`;
      return { name: variantName, sku };
    });

    return res.json({ variants });

  } catch (error) {
    console.error('Error generating variant names:', error);
    return res.status(500).json({ message: 'Server error.', error: error.message });
  }
};


exports.generateVariants = async (req, res) => {
  const t = await Variant.sequelize.transaction();
  try {
    const { id: product_id } = req.params;
    const variants = typeof req.body.variants === 'string' 
      ? JSON.parse(req.body.variants) 
      : req.body.variants;

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Variants array required.' });
    }

   


    const product = await Product.findOne({ where: { id: product_id} });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: 'Product not found.' });
    }

    const createdVariants = [];
    const inventoryLogs = [];

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];

    
      const skuCheck = await Variant.findOne({ where: { sku: v.sku } });
      if (skuCheck) {
        await t.rollback();
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


    
      const attrComboCheck = await Variant.findOne({ 
        where: { 
          product_id, 
          attributes: v.attributes 
        } 
      });
      if (attrComboCheck) {
        await t.rollback();
        return res.status(409).json({ message: 'Variant with this attribute combination already exists.' });
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
        product_id,
        attributes: v.attributes || {},
        cost_price: v.cost_price || 0,
        selling_price: v.selling_price || 0,
        quantity: v.quantity || 0,
        threshold: v.threshold ?? 0,
        sku: v.sku,
        image_url: variantImages,
        expiry_date: v.expiry_date || null,
        is_active: true,
        barcode: finalBarcode
      }, { transaction: t });

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
      await InventoryLog.bulkCreate(inventoryLogs, { transaction: t });
    }

    await t.commit();
    return res.status(201).json({ message: 'Variants generated.', variants: createdVariants });
  } catch (err) {
    await t.rollback();
    console.error('Error generating variants:', err);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.ListVariants = async (req, res) => {
  const { product_id, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { count, rows } = await Variant.findAndCountAll({
      where: { product_id },
      offset: Number(offset),
      limit: Number(limit),
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json({
      variants: rows,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

exports.getVariant = async (req, res) => {
  const { id } = req.params;
  try {
    const variant = await Variant.findByPk(id);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found.' });
    }
    return res.status(200).json(variant);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.getVariantByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode || barcode.trim().length === 0) {
      return res.status(400).json({ message: 'Barcode is required.' });
    }

    const variant = await Variant.findOne({
      where: { barcode: barcode.trim(), is_active: true },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'unit', 'hasVariation'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!variant) {
      return res.status(404).json({ 
        message: 'Variant with this barcode not found or inactive.',
        barcode_scanned: barcode
      });
    }

    
    const isOutOfStock = variant.quantity <= 0;
    const isLowStock = variant.quantity > 0 && variant.quantity <= (variant.threshold || 0);

    return res.status(200).json({
      success: true,
      variant: {
        id: variant.id,
        product_id: variant.product_id,
        sku: variant.sku,
        barcode: variant.barcode,
        attributes: variant.attributes,
        cost_price: parseFloat(variant.cost_price),
        selling_price: parseFloat(variant.selling_price),
        quantity: variant.quantity,
        threshold: variant.threshold,
        image_url: variant.image_url,
        product: {
          id: variant.product?.id,
          name: variant.product?.name,
          brand: variant.product?.brand,
          unit: variant.product?.unit,
          hasVariation: variant.product?.hasVariation,
          category: {
            id: variant.product?.category?.id,
            name: variant.product?.category?.name
          }
        },
        stock_status: {
          available: !isOutOfStock,
          quantity: variant.quantity,
          is_out_of_stock: isOutOfStock,
          is_low_stock: isLowStock,
          threshold: variant.threshold,
          message: isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching variant by barcode:', error);
    return res.status(500).json({ 
      message: 'Server error.', 
      error: error.message 
    });
  }
};

exports.searchVariantsByBarcode = async (req, res) => {
  try {
    const { barcode_query } = req.query;

    if (!barcode_query || barcode_query.trim().length < 2) {
      return res.status(400).json({ 
        message: 'Barcode query must be at least 2 characters.' 
      });
    }

    const variants = await Variant.findAll({
      where: {
        [Op.or]: [
          { barcode: { [Op.iLike]: `%${barcode_query}%` } },
          { sku: { [Op.iLike]: `%${barcode_query}%` } }
        ],
        is_active: true,
        quantity: { [Op.gt]: 0 }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'unit'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      limit: 15,
      order: [['barcode', 'ASC']]
    });

    return res.status(200).json({
      results: variants.map(v => ({
        variant_id: v.id,
        product_id: v.product_id,
        barcode: v.barcode,
        sku: v.sku,
        product_name: v.product?.name,
        brand: v.product?.brand,
        category: v.product?.category?.name,
        selling_price: parseFloat(v.selling_price),
        quantity: v.quantity,
        available: v.quantity > 0
      })),
      count: variants.length
    });
  } catch (error) {
    console.error('Error searching variants:', error);
    return res.status(500).json({ 
      message: 'Server error.', 
      error: error.message 
    });
  }
};

exports.getVariantsByBarcodes = async (req, res) => {
  try {
    const { barcodes } = req.body;

    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ 
        message: 'Array of barcodes is required.' 
      });
    }

    const variants = await Variant.findAll({
      where: {
        barcode: { [Op.in]: barcodes },
        is_active: true
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'unit'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    const notFound = barcodes.filter(
      b => !variants.find(v => v.barcode === b)
    );

    return res.status(200).json({
      success: true,
      variants: variants.map(v => ({
        id: v.id,
        barcode: v.barcode,
        sku: v.sku,
        product_name: v.product?.name,
        selling_price: parseFloat(v.selling_price),
        quantity: v.quantity
      })),
      not_found: notFound,
      count: variants.length
    });
  } catch (error) {
    console.error('Error fetching variants by barcodes:', error);
    return res.status(500).json({ 
      message: 'Server error.', 
      error: error.message 
    });
  }
};

exports.scanBarcode = async (req, res) => {
  try {
    let { barcode, barcodes } = req.body;

    
    if (barcode) barcodes = [barcode];
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ message: 'barcode or barcodes required' });
    }

    const variants = await Variant.findAll({
      where: {
        barcode: barcodes,
        is_active: true,
      },
      include: [{
        model: Product,
        attributes: ['id', 'name', 'taxable'],
      }],
    });

    const variantMap = new Map(
      variants.map(v => [v.barcode, v])
    );

    const results = barcodes.map(code => {
      const variant = variantMap.get(code);

      if (!variant) {
        return { barcode: code, status: 'invalid' };
      }

      if (variant.quantity <= 0) {
        return {
          barcode: code,
          sku: variant.sku,
          status: 'out_of_stock',
        };
      }

      return {
        barcode: code,
        status: 'ok',
        variant: {
          id: variant.id,
          product_id: variant.product_id,
          product_name: variant.Product.name,
          sku: variant.sku,
          attributes: variant.attributes,
          price: Number(variant.selling_price),
          stock: variant.quantity,
          taxable: variant.Product.taxable,
          image: variant.image_url?.[0] ?? null,
        },
      };
    });

    return res.status(200).json({ items: results });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateVariant = async (req, res) => {
  const t = await Variant.sequelize.transaction();
  try {
    const { id } = req.params;

   
    const variant = await Variant.findByPk(id, { transaction: t });
    if (!variant) {
      await t.rollback();
      return res.status(404).json({ message: "Variant not found." });
    }

   
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    
    const saveFilesToUploads = (files) => {
      return files.map(file => {
        const fileName = `variant-${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return {
          filename: fileName,
          url: `/uploads/${fileName}`
        };
      });
    };

    
    const variantFiles = (req.files || []).filter(f => f.fieldname === "image_url");
    let uploadedImages = [];
    if (variantFiles.length > 0) {
      uploadedImages = saveFilesToUploads(variantFiles);
    }


    let existingImages = Array.isArray(variant.image_url) ? variant.image_url : [];

    
    const deleteImages = req.body?.deleteImages
      ? Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages]
      : [];

    for (const filename of deleteImages) {
      try {
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        existingImages = existingImages.filter(img => img.filename !== filename);
      } catch (err) {
        console.error(`Failed to delete image ${filename}:`, err.message);
      }
    }

    
    const replaceImages = req.body?.replace_images === "true";


    let finalImages = [];
    if (replaceImages) {
      finalImages = uploadedImages;
    } else {
      finalImages = [...existingImages, ...uploadedImages];
      finalImages = finalImages.filter((img, index, self) =>
        index === self.findIndex(i => i.filename === img.filename)
      );
    }

 
    const updatableFields = [
      "attributes", "cost_price", "selling_price", "quantity",
      "threshold", "sku", "expiry_date", "barcode"
    ];

   
    const oldQuantity = variant.quantity;
    let quantityChanged = false;

 
    const updateData = {};
    for (const field of updatableFields) {
      if (req.body?.[field] !== undefined) {
        let value = req.body[field];
        if (["quantity", "threshold"].includes(field)) value = parseInt(value, 10);
        if (["cost_price", "selling_price"].includes(field)) value = parseFloat(value);
        if (field === "attributes" && typeof value !== "string") value = value; // JSON
        if (field === "expiry_date") {
          if (value) {
            const dateValue = new Date(value);
            if (!isNaN(dateValue)) {
              value = dateValue;
            } else {
              console.warn(`Invalid expiry_date skipped: ${value}`);
              continue;
            }
          } else {
            continue;
          }
        }

        if (JSON.stringify(variant[field]) !== JSON.stringify(value)) {
          updateData[field] = value;
          if (field === "quantity") quantityChanged = true;
        }
      }
    }

 
    if (JSON.stringify(variant.image_url || []) !== JSON.stringify(finalImages)) {
      updateData.image_url = finalImages;
    }

    if (Object.keys(updateData).length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "No changes detected." });
    }

   
    await variant.update(updateData, { transaction: t });


    if (quantityChanged) {
      const newQuantity = variant.quantity;
      const diff = newQuantity - oldQuantity;
      const type = diff > 0 ? 'restock' : 'sale';
      const reason = diff > 0 ? 'increase' : 'decrease';
      const note = `Quantity updated from ${oldQuantity} to ${newQuantity}`;

      await InventoryLog.create({
        variant_id: variant.id,
        type,
        quantity: Math.abs(diff),
        reason,
        note,
        recorded_by: req.user.admin_id,
        recorded_by_type: 'admin'
      }, { transaction: t });
    }

    await t.commit();
    return res.status(200).json({ message: "Variant updated successfully.", variant });
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ message: "Server error.", details: err.message });
  }
};

exports.deleteVariant = async (req, res) => {
  const t = await Variant.sequelize.transaction();
  try {
    const { variant_id } = req.params;

    
    const variant = await Variant.findByPk(variant_id, {
      include: [{ model: InventoryLog, as: 'inventory_logs' }],
      transaction: t
    });

    if (!variant) {
      await t.rollback();
      return res.status(404).json({ message: 'Variant not found.' });
    }

  
    const imagesToDelete = Array.isArray(variant.image_url) ? variant.image_url : [];

    
    if (variant.inventory_logs.length > 0) {
      await InventoryLog.destroy({
        where: { variant_id },
        transaction: t
      });
    }

    
    await variant.destroy({ transaction: t });

    
    await t.commit();

    
    const uploadsDir = path.join(__dirname, '../../uploads');
    for (const img of imagesToDelete) {
      if (img.filename) {
        try {
          const filePath = path.join(uploadsDir, img.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${img.filename}:`, err.message);
        }
      }
    }

    return res.status(200).json({ message: 'Variant and its inventory logs deleted successfully.' });
  } catch (err) {
    await t.rollback();
    console.error('Error deleting variant:', err);
    return res.status(500).json({ message: 'Server error.', details: err.message });
  }
};


exports.listVariantsWithProduct = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'created_at' } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { barcode: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { '$product.name$': { [Op.like]: `%${search}%` } }
      ];
    }

    const orderClause = [];
    if (sort === 'barcode') {
      orderClause.push(['barcode', 'ASC']);
    } else if (sort === 'sku') {
      orderClause.push(['sku', 'ASC']);
    } else if (sort === 'product_name') {
      orderClause.push([{ model: Product, as: 'product' }, 'name', 'ASC']);
    } else {
      orderClause.push(['created_at', 'DESC']);
    }

    const { count, rows } = await Variant.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name'],
        }
      ],
      attributes: ['id', 'sku', 'barcode', 'created_at'],
      offset,
      limit: limitNum,
      order: orderClause,
      subQuery: false
    });

    const formattedVariants = rows.map(variant => ({
      variant_id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      product_id: variant.product?.id,
      product_name: variant.product?.name,
      created_at: variant.created_at
    }));

    return res.status(200).json({
      success: true,
      variants: formattedVariants,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      },
      filters: {
        search: search || null,
        sort
      },
      summary: {
        displayed_variants: formattedVariants.length,
      }
    });

  } catch (error) {
    console.error('❌ listVariantsWithProduct error:', error);
    return res.status(500).json({
      error: 'Failed to fetch variants with product information',
      details: error.message
    });
  }
};

exports.listVariantsWithAllDetails = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'created_at', product_id, stock_status } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

 
    if (search) {
      whereClause[Op.or] = [
        { barcode: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { '$product.name$': { [Op.like]: `%${search}%` } }
      ];
    }

  
    if (product_id) {
      whereClause.product_id = parseInt(product_id, 10);
    }

   
    if (stock_status) {
      if (stock_status === 'out_of_stock') {
        whereClause.quantity = { [Op.lte]: 0 };
      } else if (stock_status === 'low_stock') {
        whereClause[Op.and] = [
          sequelize.where(sequelize.col('quantity'), Op.gt, 0),
          sequelize.where(sequelize.col('quantity'), Op.lte, sequelize.col('threshold'))
        ];
      } else if (stock_status === 'in_stock') {
        whereClause.quantity = { [Op.gt]: sequelize.col('threshold') };
      }
    }


    const orderClause = [];
    if (sort === 'barcode') {
      orderClause.push(['barcode', 'ASC']);
    } else if (sort === 'sku') {
      orderClause.push(['sku', 'ASC']);
    } else if (sort === 'product_name') {
      orderClause.push([{ model: Product, as: 'product' }, 'name', 'ASC']);
    } else if (sort === 'price_low') {
      orderClause.push(['selling_price', 'ASC']);
    } else if (sort === 'price_high') {
      orderClause.push(['selling_price', 'DESC']);
    } else if (sort === 'quantity') {
      orderClause.push(['quantity', 'DESC']);
    } else {
      orderClause.push(['created_at', 'DESC']);
    }

    const { count, rows } = await Variant.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'description', 'unit', 'taxable', 'hasVariation'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      attributes: [
        'id',
        'sku',
        'barcode',
        'attributes',
        'cost_price',
        'selling_price',
        'quantity',
        'threshold',
        'image_url',
        'expiry_date',
        'is_active',
        'created_at',
        'updated_at'
      ],
      offset,
      limit: limitNum,
      order: orderClause,
      subQuery: false,
      distinct: true
    });

  
    const formattedVariants = rows.map(variant => {
      const isOutOfStock = variant.quantity <= 0;
      const isLowStock = variant.quantity > 0 && variant.quantity <= (variant.threshold || 0);
      const profitMargin = variant.selling_price > 0 && variant.cost_price > 0
        ? (((variant.selling_price - variant.cost_price) / variant.cost_price) * 100).toFixed(2)
        : 0;

      return {
        variant_id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        attributes: variant.attributes || {},
        product: {
          id: variant.product?.id,
          name: variant.product?.name,
          brand: variant.product?.brand,
          description: variant.product?.description,
          unit: variant.product?.unit,
          taxable: variant.product?.taxable,
          hasVariation: variant.product?.hasVariation,
          category: {
            id: variant.product?.category?.id,
            name: variant.product?.category?.name
          }
        },
        pricing: {
          cost_price: parseFloat(variant.cost_price),
          selling_price: parseFloat(variant.selling_price),
          profit_margin: `${profitMargin}%`
        },
        stock: {
          quantity: variant.quantity,
          threshold: variant.threshold || 0,
          is_out_of_stock: isOutOfStock,
          is_low_stock: isLowStock,
          status: isOutOfStock ? 'out_of_stock' : isLowStock ? 'low_stock' : 'in_stock',
          status_label: isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'
        },
        media: {
          images: variant.image_url || [],
          image_count: Array.isArray(variant.image_url) ? variant.image_url.length : 0
        },
        expiry_date: variant.expiry_date || null,
        is_active: variant.is_active,
        created_at: variant.created_at,
        updated_at: variant.updated_at
      };
    });

  
    const summaryStats = {
      total_variants: count,
      displayed_variants: formattedVariants.length,
      out_of_stock_count: formattedVariants.filter(v => v.stock.is_out_of_stock).length,
      low_stock_count: formattedVariants.filter(v => v.stock.is_low_stock).length,
      in_stock_count: formattedVariants.filter(v => !v.stock.is_out_of_stock && !v.stock.is_low_stock).length,
      total_quantity: formattedVariants.reduce((sum, v) => sum + v.stock.quantity, 0),
      average_selling_price: (formattedVariants.reduce((sum, v) => sum + v.pricing.selling_price, 0) / formattedVariants.length).toFixed(2)
    };

    return res.status(200).json({
      success: true,
      variants: formattedVariants,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      },
      filters: {
        search: search || null,
        sort,
        product_id: product_id || null,
        stock_status: stock_status || null
      },
      summary: summaryStats
    });

  } catch (error) {
    console.error('❌ listVariantsWithAllDetails error:', error);
    return res.status(500).json({
      error: 'Failed to fetch variants with all details',
      details: error.message
    });
  }
};