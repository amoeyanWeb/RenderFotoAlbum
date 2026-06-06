const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const path = require("path");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const FIREBASE_DB_URL =
  "https://fotoalbum-ac441-default-rtdb.europe-west1.firebasedatabase.app";

// تنظیمات کلودینری
cloudinary.config({
  cloud_name: "delf4luxo",
  api_key: "925938693554627",
  api_secret: "FEnSdhP9qa7qx9X882awdUfJbJ4",
});

// ── مسیر لاگین امن (با REST API مستقیم Firebase) ─
app.post("/secureLogin", async (req, res) => {
  const { username, password, type } = req.body;
  try {
    // خواندن مستقیم از Firebase RTDB با REST API
    const response = await fetch(`${FIREBASE_DB_URL}/.json`);
    const creds = await response.json();

    let isValid = false;
    if (type === "system") {
      isValid =
        username === creds.systemUsername && password === creds.systemPassword;
    } else if (type === "admin") {
      isValid =
        username === creds.adminUsername && password === creds.adminPassword;
    }

    if (isValid) {
      return res.status(200).send({ success: true, message: "ورود موفق" });
    } else {
      return res.status(401).send({
        success: false,
        error: "نام کاربری یا رمز عبور اشتباه است",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send({
      success: false,
      error: "خطا در اتصال به دیتابیس",
    });
  }
});

// ── مسیر امضای کلودینری ─
app.post("/getCloudinarySignature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp: timestamp,
      upload_preset: req.body.upload_preset || "ml_default",
    };
    // اگه context ارسال شده، به امضا اضافه می‌شه
    if (req.body.context) {
      paramsToSign.context = req.body.context;
    }
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      cloudinary.config().api_secret,
    );
    return res.status(200).send({
      success: true,
      signature: signature,
      timestamp: timestamp,
      api_key: cloudinary.config().api_key,
      cloud_name: cloudinary.config().cloud_name,
      context: paramsToSign.context || null,
    });
  } catch (error) {
    return res.status(500).send({ success: false, error: error.message });
  }
});

// ── فایل‌های استاتیک ──
app.use(express.static(__dirname));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
