const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("mongo-sanitize");
const xss = require("xss-clean");

const connectDB = require("./config/db");
const { PORT, NODE_ENV, CLIENT_ORIGIN } = require("./config/env");
const { notFound, errorHandler } = require("./middlewares/error");

// Import routes
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const uploadRoutes = require("./routes/upload.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const orderRoutes = require("./routes/order.routes");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(helmet());

// ===== CORS configuration (استخدم CLIENT_ORIGIN إن وُجد) =====
// ===== CORS (Dev mirrors origin / Prod uses CLIENT_ORIGIN) =====
const ORIGIN_ENV = (CLIENT_ORIGIN || '').trim();

const corsOptions = (NODE_ENV === 'development')
  ? {
      // في التطوير: اسمح بأي Origin وخلّه يُعاد كـ Access-Control-Allow-Origin
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }
  : {
      // في الإنتاج: أصل واحد (من .env)
      origin: ORIGIN_ENV || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    };

app.use(cors(corsOptions));
// دعم الـ preflight صريحًا
app.options('*', cors(corsOptions));

// (اختياري) لوغ بسيط لتشخيص الـ Origin الداخل
app.use((req, _res, next) => {
  if (req.headers.origin) {
    console.log('[CORS] Request from:', req.headers.origin);
  }
  next();
});


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Security middleware
app.use(xss());
app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

// Logging
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV 
  });
});

// ===== API routes (بعد تفعيل CORS والبارس) =====
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/users", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/whatsapp", whatsappRoutes); // ← نُقلت هنا بعد CORS

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
