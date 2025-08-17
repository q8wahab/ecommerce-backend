const Order = require('../models/Order');
const Product = require('../models/Product');

const createOrder = async (req, res) => {
  try {
    const { email, items, shippingInFils, address } = req.body;
    
    // Validate items and calculate subtotal
    let subtotalInFils = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.status !== 'active') {
        return res.status(400).json({ 
          error: `Product not found: ${item.productId}` 
        });
      }
      
      if (product.stock < item.qty) {
        return res.status(400).json({ 
          error: `Insufficient stock for product: ${product.title}` 
        });
      }
      
      const itemTotal = product.priceInFils * item.qty;
      subtotalInFils += itemTotal;
      
      validatedItems.push({
        product: product._id,
        title: product.title,
        priceInFils: product.priceInFils,
        currency: product.currency,
        qty: item.qty
      });
    }
    
    const totalInFils = subtotalInFils + shippingInFils;
    
    // Create order
    const order = new Order({
      user: req.user?._id || null,
      email,
      items: validatedItems,
      subtotalInFils,
      shippingInFils,
      totalInFils,
      address
    });
    
    await order.save();
    
    // Update product stock
    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty }
      });
    }
    
    res.status(201).json({
      id: order._id,
      subtotalInFils,
      shippingInFils,
      totalInFils,
      status: order.status,
      createdAt: order.createdAt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = { _id: id };
    
    // If user is not admin, only allow access to their own orders
    if (req.user.role !== 'admin') {
      if (req.user._id) {
        query.user = req.user._id;
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const order = await Order.findOne(query)
      .populate('items.product', 'title slug images')
      .populate('user', 'name email');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrder
};

