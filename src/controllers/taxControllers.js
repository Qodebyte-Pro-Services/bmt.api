const { Tax, sequelize } = require("../models");


exports.createTax = async (req, res) => {
  try {
    const { taxRate } = req.body;

    if ( !taxRate) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }


    if (taxRate < 0 || taxRate > 1) {
      return res.status(400).json({ message: 'Tax rate must be between 0 and 1.' });
    }

    const tax = await Tax.create({
      taxRate,
    });

    return res.status(201).json({ tax });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};




exports.getTaxRate = async (req, res) => {
  try {
    const taxes = await Tax.findAll();
    return res.status(200).json({ taxes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error.', error });
  }
}




exports.updateTaxRate =  async (req, res) => {
    try {
        const {id} = req.params;
        const {taxRate} = req.body;

        const existing = await Tax.findByPk(id);
        if (!existing) {
            return res.status(404).json({ message: 'Tax not found.' });
        }

        const updatedTax = await Tax.update({taxRate}, {where: {id}});
        return res.status(200).json({ tax: updatedTax });
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.', error });
    }
}




exports.deleteTax = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const tax = await Tax.findByPk(id, { transaction: t });
    if (!tax) {
      await t.rollback();
      return res.status(404).json({ message: 'Tax not found.' });
    }

    
    await tax.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: 'Tax deleted successfully.' });

  } catch (error) {
    console.error(error);
    await t.rollback();
    return res.status(500).json({ message: 'Server error.', error: error.message });
  }
};


