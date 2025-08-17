# E-commerce Backend API

A robust Node.js/Express backend API for e-commerce applications with MongoDB and Cloudinary integration.

## Features
- User authentication with JWT
- Product management (CRUD operations)
- Category management
- Order processing
- Shopping cart functionality
- Wishlist management
- Image upload to Cloudinary
- User role management (admin/customer)
- Input validation and error handling
- Rate limiting and security middleware

## Technologies Used
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Cloudinary for image storage
- bcryptjs for password hashing
- Helmet for security
- Express Rate Limit
- CORS

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Environment Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_REFRESH_SECRET`: Secret key for refresh tokens
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Cloudinary API key
- `CLOUDINARY_API_SECRET`: Cloudinary API secret

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order by ID

### Wishlist
- `GET /api/wishlist` - Get user wishlist
- `POST /api/wishlist` - Add item to wishlist
- `DELETE /api/wishlist/:productId` - Remove item from wishlist

### Upload
- `POST /api/uploads/image` - Upload image to Cloudinary (admin only)

## Database Models
- User (authentication and profile)
- Product (product information)
- Category (product categories)
- Order (order management)

## Security Features
- Password hashing with bcryptjs
- JWT token authentication
- Rate limiting
- CORS configuration
- Input validation
- Error handling middleware

## Deployment
For production deployment:
1. Set NODE_ENV=production
2. Configure production MongoDB URI
3. Set secure JWT secrets
4. Configure Cloudinary credentials
5. Deploy to your hosting service (Render, Heroku, etc.)

## Frontend Integration
This backend is designed to work with the corresponding React e-commerce frontend.
