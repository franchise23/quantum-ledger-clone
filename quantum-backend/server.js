require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_fallback_secret";
// Allow your frontend origins (relaxed for demo; tighten for production)
app.use(
  cors({
    origin: true, // reflect request origin
    credentials: false,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// In-memory user store (for demo / school project)
const users = [];
let nextUserId = 1;

// Helper: generate JWT
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// Helper: auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ROUTES

// Health check
app.get("/", (req, res) => {
  res.send("Quantum Ledger backend is running");
});

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const existing = users.find((u) => u.email === normalizedEmail);
    if (existing) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: nextUserId++,
      name,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    const token = generateToken(newUser);

    return res.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("Error in /api/register:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const user = users.find((u) => u.email === normalizedEmail);

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error in /api/login:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
app.get("/api/me", authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
