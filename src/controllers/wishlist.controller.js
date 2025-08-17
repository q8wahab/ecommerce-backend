const User = require('../models/User');
const Product = require('../models/Product');

const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'wishlist',
        populate: {
          path: 'category',
          select: 'name slug'
        },
        select: 'title slug priceInFils currency stock rating images status'
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Format wishlist products
    const wishlist = user.wishlist
      .filter(product => product.status === 'active')
      .map(product => ({
        ...product.toObject(),
        image: product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url || null
      }));
    
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isInWishlist = user.wishlist.includes(productId);
    
    if (isInWishlist) {
      // Remove from wishlist
      await User.findByIdAndUpdate(userId, {
        $pull: { wishlist: productId }
      });
    } else {
      // Add to wishlist
      await User.findByIdAndUpdate(userId, {
        $addToSet: { wishlist: productId }
      });
    }
    
    // Get updated wishlist count
    const updatedUser = await User.findById(userId);
    
    res.json({
      wished: !isInWishlist,
      wishlistCount: updatedUser.wishlist.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getWishlist,
  toggleWishlist
};

