/* ════════════════════════════════════════════════════════════
   app.js — نسخه Firebase
   تمام داده‌ها (عکس‌ها، رویدادها، مناسبت‌ها) در Firebase RTDB
   نیازی به data.js نیست — هر تغییر مستقیم در دیتابیس ذخیره می‌شود
   ════════════════════════════════════════════════════════════ */
// وقتی پروژه را روی رندر آپلود کردید، این آدرس را با آدرس سایت رندرتان عوض خواهید کرد

(function () {
  // ══════════════════════════════════════════════════════════
  //  ⚙️  تنظیمات Firebase و Cloudinary
  // ══════════════════════════════════════════════════════════
  const FUNCTIONS_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : `${window.location.protocol}//${window.location.host}`;

  const firebaseConfig = {
    apiKey: "AIzaSyCNetG7kzLaOiX1PF93tx1B7nLWm-2By_8",
    authDomain: "fotoalbum-ac441.firebaseapp.com",
    databaseURL:
      "https://fotoalbum-ac441-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fotoalbum-ac441",
    storageBucket: "fotoalbum-ac441.firebasestorage.app",
    messagingSenderId: "547954410485",
    appId: "1:547954410485:web:2f3a1b4c90f5d7bdf8d6bc",
    measurementId: "G-CDPYPS3EH5",
  };

  const CONFIG = {
    cloudName: "delf4luxo",
    uploadPreset: "ml_default",
    // apiKey: "925938693554627",
    // apiSecret: "FEnSdhP9qa7qx9X882awdUfJbJ4",
  };

  // ══════════════════════════════════════════════════════════
  //  پایین این خط نیاز به تغییر ندارد
  // ══════════════════════════════════════════════════════════

  // ── Firebase init ──
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();

  // ── حافظه محلی (کش) ──
  // DATA: { [occasion]: [ { label, photos: [{src, title}] } ] }  — آرایه‌ای مانند قبل
  window.DATA = {};
  window.LABELS = {};

  // const FUNCTIONS_BASE_URL =
  //   "https://us-central1-fotoalbum-ac441.cloudfunctions.net";

  let _cfg = {
    cloudName: CONFIG.cloudName,
    preset: CONFIG.uploadPreset,
    apiKey: CONFIG.apiKey,
    apiSecret: CONFIG.apiSecret,
    sysUser: "",
    sysPass: "",
    adminUser: "",
    adminPass: "",
  };

  function cfg(k) {
    return _cfg[k] || "";
  }
  function setCfg(k, v) {
    _cfg[k] = v;
  }

  let apQueue = [];
  let pwdTargetType = "";

  // ══════════════════════════════════════════════════════════
  //  Firebase Helper Functions
  // ══════════════════════════════════════════════════════════

  // تبدیل ساختار Firebase (آبجکت با کلید e0,e1,...) به آرایه
  function fbEventsToArray(eventsObj) {
    if (!eventsObj) return [];
    return Object.entries(eventsObj)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([key, ev]) => ({
        _fbKey: key,
        label: ev.label || "",
        photos: fbPhotosToArray(ev.photos),
      }));
  }

  function fbPhotosToArray(photosObj) {
    if (!photosObj) return [];
    return Object.entries(photosObj)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([key, p]) => ({
        _fbKey: key,
        src: p.src || "",
        title: p.title || "",
      }));
  }

  // تولید کلید یکتا برای Firebase
  function fbKey() {
    return (
      "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    );
  }

  // بارگذاری کامل داده‌ها از Firebase
  // تغییر یافته برای امنیت بالاتر
  async function loadAllData() {
    const [labelsSnap, albumsSnap] = await Promise.all([
      rtdb.ref("/labels").once("value"),
      rtdb.ref("/albums").once("value"),
      // ❌ خط مربوط به دریافت پسوردها کاملاً حذف شد
    ]);

    window.LABELS = labelsSnap.val() || {};
    window.DATA = {};

    Object.keys(albumsSnap.val() || {}).forEach(function (occ) {
      window.DATA[occ] = fbEventsToArray(albumsSnap.val()[occ]);
    });

    // تنظیمات فقط نام کلودینری به صورت پابلیک می‌ماند
    _cfg.cloudName = "delf4luxo";
    _cfg.preset = "ml_default";

    return true;
  }

  // ذخیره credentials در Firebase
  async function saveCredentialsToFirebase(updates) {
    try {
      await rtdb.ref("/").update(updates);
      return true;
    } catch (err) {
      console.error("Firebase RTDB write error:", err);
      return false;
    }
  }

  // ذخیره یک رویداد در Firebase (ایجاد یا بروزرسانی)
  async function saveEventToFB(occ, eventIdx) {
    const ev = window.DATA[occ][eventIdx];
    if (!ev) return;
    const key = ev._fbKey || "e" + eventIdx;

    const photosObj = {};
    (ev.photos || []).forEach(function (p, pIdx) {
      const pKey = p._fbKey || "p" + pIdx;
      photosObj[pKey] = { src: p.src, title: p.title || "", order: pIdx };
      p._fbKey = pKey;
    });

    const evObj = { label: ev.label, order: eventIdx, photos: photosObj };
    await rtdb.ref("/albums/" + occ + "/" + key).set(evObj);
    ev._fbKey = key;
  }

  // حذف یک رویداد از Firebase
  async function deleteEventFromFB(occ, fbKey) {
    await rtdb.ref("/albums/" + occ + "/" + fbKey).remove();
  }

  // حذف یک عکس از Firebase
  async function deletePhotoFromFB(occ, eventFbKey, photoFbKey) {
    await rtdb
      .ref("/albums/" + occ + "/" + eventFbKey + "/photos/" + photoFbKey)
      .remove();
  }

  // اضافه کردن یک عکس به Firebase
  async function addPhotoToFB(occ, eventIdx, photoData) {
    const ev = window.DATA[occ][eventIdx];
    if (!ev || !ev._fbKey) return;
    const pKey = fbKey();
    const order = (ev.photos || []).length - 1;
    await rtdb.ref("/albums/" + occ + "/" + ev._fbKey + "/photos/" + pKey).set({
      src: photoData.src,
      title: photoData.title || "",
      order: order,
    });
    photoData._fbKey = pKey;
  }

  // بروزرسانی order رویدادها بعد از splice
  async function reorderEventsFB(occ) {
    const updates = {};
    (window.DATA[occ] || []).forEach(function (ev, idx) {
      if (ev._fbKey)
        updates["/albums/" + occ + "/" + ev._fbKey + "/order"] = idx;
    });
    if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
  }

  // ══════════════════════════════════════════════════════════
  //  بارگذاری اولیه
  // ══════════════════════════════════════════════════════════

  let _dataLoaded = false;
  let _dataCallbacks = [];

  function onDataReady(cb) {
    if (_dataLoaded) {
      cb();
      return;
    }
    _dataCallbacks.push(cb);
  }

  loadAllData()
    .then(function () {
      _dataLoaded = true;
      window._dataLoaded = true;
      _dataCallbacks.forEach(function (cb) {
        cb();
      });
      _dataCallbacks = [];
      // بعد از لود، پنجره لاگین را نشان بده
      const systemModal = document.getElementById("initialLoginModal");
      if (systemModal)
        systemModal.style.setProperty("display", "flex", "important");
    })
    .catch(function (err) {
      console.error("Firebase load error:", err);
      _dataLoaded = true;
      window._dataLoaded = true;
      _dataCallbacks.forEach(function (cb) {
        cb();
      });
      _dataCallbacks = [];
      const systemModal = document.getElementById("initialLoginModal");
      if (systemModal)
        systemModal.style.setProperty("display", "flex", "important");
    });

  // ══════════════════════════════════════════════════════════
  //  System Login
  // ══════════════════════════════════════════════════════════

  window.doSystemLogin = async function () {
    const u = document.getElementById("lgUser").value.trim();
    const p = document.getElementById("lgPass").value;
    const errEl = document.getElementById("lgErr");
    errEl.textContent = "";

    if (!u || !p) {
      errEl.textContent = "لطفاً تمام فیلدها را پر کنید";
      return;
    }

    errEl.textContent = "⏳ در حال بررسی اطلاعات ورود...";

    try {
      const response = await fetch(`${FUNCTIONS_BASE_URL}/secureLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p, type: "system" }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        document.getElementById("initialLoginModal").style.display = "none";
        sessionStorage.setItem("initialLoggedIn", "true");
        if (typeof fillOccasionSelector === "function") {
          fillOccasionSelector(
            document.getElementById("selOccasion"),
            "— انتخاب مناسبت —",
          );
        }
      } else {
        errEl.textContent = result.error || "نام کاربری یا رمز اشتباه است";
      }
    } catch (err) {
      errEl.textContent = "❌ خطا در اتصال به سرور ابری";
      console.error(err);
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    const adminPanelEl = document.getElementById("adminPanel");
    if (adminPanelEl) adminPanelEl.style.display = "none";
    const loginCardEl = document.getElementById("loginCard");
    if (loginCardEl) loginCardEl.style.display = "none";

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    const myToast = document.getElementById("apToast");
    if (myToast) myToast.style.display = "none";

    // سیستم لاگین حالا از index.html انجام می‌شود — modal نداریم
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.display = "none";
  });

  // ══════════════════════════════════════════════════════════
  //  Admin Panel Open/Close
  // ══════════════════════════════════════════════════════════
  //  تغییر زبان — سشن حفظ می‌شود، فقط صفحه عوض می‌شود
  // ══════════════════════════════════════════════════════════

  window.switchLang = function (lang) {
    sessionStorage.setItem("initialLoggedIn", "true");
    sessionStorage.setItem("albumLang", lang);
    const map = { TR: "indexTR.html", FA: "indexFA.html", EN: "indexEN.html" };
    window.location.href = map[lang] || "indexTR.html";
  };

  // ══════════════════════════════════════════════════════════

  window.openAdmin = function () {
    if (sessionStorage.getItem("initialLoggedIn") !== "true") {
      const systemModal = document.getElementById("initialLoginModal");
      if (systemModal)
        systemModal.style.setProperty("display", "flex", "important");
      return;
    }

    document.getElementById("adUser").value = "";
    document.getElementById("adPass").value = "";
    document.getElementById("adErr").textContent = "";

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    // نمایش آورلی
    const overlay = document.getElementById("adminOverlay");
    if (overlay) overlay.style.display = "block";

    const loginCard = document.getElementById("loginCard");
    loginCard.style.display = "block";
    loginCard.style.position = "fixed";
    loginCard.style.top = "50%";
    loginCard.style.left = "50%";
    loginCard.style.transform = "translate(-50%, -50%)";
    loginCard.style.zIndex = "10000";

    document.getElementById("adminPanel").style.display = "none";
  };

  window.doAdminLogin = async function () {
    const u = document.getElementById("adUser").value.trim();
    const p = document.getElementById("adPass").value;
    const errEl = document.getElementById("adErr");

    if (errEl) errEl.textContent = "";

    if (!u || !p) {
      if (errEl) errEl.textContent = "لطفاً تمام فیلدها را پر کنید";
      return;
    }

    if (errEl) errEl.textContent = "⏳ در حال بررسی اطلاعات ورود ادمین...";

    try {
      // ارسال درخواست به سرور (Render / localhost)
      const response = await fetch(`${FUNCTIONS_BASE_URL}/secureLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p, type: "admin" }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // ورود موفقیت‌آمیز ادمین
        document.getElementById("loginCard").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";

        // ذخیره وضعیت لاگین در sessionStorage برای ماندگاری موقت
        sessionStorage.setItem("adminLoggedIn", "true");

        // اجرای توابع فرعی پنل ادمین که از قبل در کد داشتید
        if (typeof initAdminPanel === "function") initAdminPanel();
      } else {
        if (errEl)
          errEl.textContent =
            result.error || "نام کاربری یا رمز عبور مدیریت اشتباه است";
      }
    } catch (err) {
      if (errEl) errEl.textContent = "❌ خطا در اتصال به سرور ابری";
      console.error("Admin Login Error:", err);
    }
  };

  window.closeAdmin = function () {
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginCard").style.display = "none";

    const overlay = document.getElementById("adminOverlay");
    if (overlay) overlay.style.display = "none";

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    apQueue = [];
    renderAdminPhotoGrid();
  };

  window.doLogout = function () {
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginCard").style.display = "none";

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    apQueue = [];
    renderAdminPhotoGrid();
  };

  function initAdminPanel() {
    refreshAllSelectors();
    apQueue = [];
    renderAdminPhotoGrid();

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    const cnEl = document.getElementById("cfgCloudName");
    const prEl = document.getElementById("cfgPreset");
    const keyEl = document.getElementById("cfgApiKey");
    const secEl = document.getElementById("cfgApiSecret");
    if (cnEl) cnEl.value = cfg("cloudName");
    if (prEl) prEl.value = cfg("preset");
    if (keyEl) keyEl.value = cfg("apiKey");
    if (secEl) secEl.value = cfg("apiSecret");
    const cfgStatus = document.getElementById("cfgStatus");
    if (cfgStatus) cfgStatus.textContent = "";
  }

  // ══════════════════════════════════════════════════════════
  //  Cloudinary Settings
  // ══════════════════════════════════════════════════════════

  window.saveCloudinarySettings = function () {
    const cloudName = (
      document.getElementById("cfgCloudName").value || ""
    ).trim();
    const preset = (document.getElementById("cfgPreset").value || "").trim();
    const apiKey = (document.getElementById("cfgApiKey").value || "").trim();
    const apiSecret = (
      document.getElementById("cfgApiSecret").value || ""
    ).trim();

    if (!cloudName) return showCfgStatus("⚠️ Cloud Name را وارد کنید", "red");
    if (!preset) return showCfgStatus("⚠️ Upload Preset را وارد کنید", "red");

    setCfg("cloudName", cloudName);
    setCfg("preset", preset);
    if (apiKey) setCfg("apiKey", apiKey);
    if (apiSecret) setCfg("apiSecret", apiSecret);

    showCfgStatus("✅ تنظیمات ذخیره شد (تا بستن مرورگر)", "green");
  };

  function showCfgStatus(msg, color) {
    const el = document.getElementById("cfgStatus");
    if (!el) return;
    el.textContent = msg;
    el.style.color = color;
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 3000);
  }

  // ══════════════════════════════════════════════════════════
  //  Password Modal
  // ══════════════════════════════════════════════════════════

  window.openPwdModal = function (type) {
    pwdTargetType = type;
    document.getElementById("pwdModalTitle").textContent =
      type === "system"
        ? "🔐 تغییر رمز ورود به سیستم"
        : "🔑 تغییر رمز پنل ادمین";
    document.getElementById("pwdModalDesc").textContent =
      type === "system"
        ? "اطلاعات فعلی و جدید را وارد کنید"
        : "اطلاعات ورود ادمین را وارد کنید";
    ["pwdNewUser", "pwdCurrentPass", "pwdNewPass", "pwdConfirmPass"].forEach(
      function (id) {
        document.getElementById(id).value = "";
      },
    );
    document.getElementById("pwdErr").textContent = "";
    document.getElementById("pwdChangeOverlay").classList.add("open");
  };

  window.closePwdModal = function () {
    var errEl = document.getElementById("pwdErr");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.color = "";
    }
    ["pwdNewUser", "pwdCurrentPass", "pwdNewPass", "pwdConfirmPass"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      },
    );
    var applyBtn = document.getElementById("pwdApplyBtn");
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = "تغییر";
    }
    document.getElementById("pwdChangeOverlay").classList.remove("open");
    pwdTargetType = "";
  };

  window.applyPwdChange = async function () {
    const newUser = document.getElementById("pwdNewUser").value.trim();
    const currentPass = document.getElementById("pwdCurrentPass").value;
    const newPass = document.getElementById("pwdNewPass").value;
    const confirmPass = document.getElementById("pwdConfirmPass").value;
    const errEl = document.getElementById("pwdErr");
    const applyBtn = document.getElementById("pwdApplyBtn");
    errEl.textContent = "";
    errEl.style.color = "";

    if (!newUser) {
      errEl.textContent = "⚠️ نام کاربری جدید را وارد کنید";
      return;
    }

    const uKey = pwdTargetType === "system" ? "sysUser" : "adminUser";
    const pKey = pwdTargetType === "system" ? "sysPass" : "adminPass";

    if (currentPass !== cfg(pKey)) {
      errEl.textContent = "⚠️ رمز عبور فعلی اشتباه است";
      return;
    }
    if (newPass.length < 6) {
      errEl.textContent = "⚠️ رمز جدید باید حداقل ۶ کاراکتر باشد";
      return;
    }
    if (newPass !== confirmPass) {
      errEl.textContent = "⚠️ رمز جدید و تکرار آن مطابقت ندارند";
      return;
    }

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = "⏳ در حال ذخیره...";
    }

    const fbUpdates =
      pwdTargetType === "system"
        ? { systemUsername: newUser, systemPassword: newPass }
        : { adminUsername: newUser, adminPassword: newPass };

    const ok = await saveCredentialsToFirebase(fbUpdates);
    if (ok) {
      setCfg(uKey, newUser);
      setCfg(pKey, newPass);
      closePwdModal();
      apToast("✅ اطلاعات ورود با موفقیت در Firebase ذخیره شد");
    } else {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = "تغییر";
      }
      errEl.textContent = "❌ خطا در ذخیره‌سازی — لطفاً دوباره تلاش کنید";
      errEl.style.color = "red";
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    var pwdOverlay = document.getElementById("pwdChangeOverlay");
    if (pwdOverlay) {
      pwdOverlay.addEventListener("click", function (e) {
        if (e.target === e.currentTarget) closePwdModal();
      });
    }
  });

  // ══════════════════════════════════════════════════════════
  //  Selectors
  // ══════════════════════════════════════════════════════════

  function fillOccasionSel(sel, placeholder) {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    Object.keys(window.DATA).forEach(function (key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = window.LABELS[key] || key;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  window.fillOccasionSelector = fillOccasionSel;

  function refreshAllSelectors() {
    ["eventOccasionSelector", "manageOccasionSelector", "selOccasion"].forEach(
      function (id) {
        const sel = document.getElementById(id);
        if (!sel) return;
        const placeholder =
          id === "selOccasion" ? "— انتخاب مناسبت —" : "انتخاب مناسبت...";
        fillOccasionSel(sel, placeholder);
      },
    );
    if (typeof window.updateEventSelector === "function")
      window.updateEventSelector();
    if (typeof fillDeleteOccasionSelector === "function")
      fillDeleteOccasionSelector();
  }

  window.updateEventSelector = function () {
    const manageOccasionSel = document.getElementById("manageOccasionSelector");
    const manageEventSel = document.getElementById("manageEventSelector");
    if (!manageOccasionSel || !manageEventSel) return;

    const occ = manageOccasionSel.value;
    const currentVal = manageEventSel.value;

    manageEventSel.innerHTML = '<option value="">انتخاب رویداد...</option>';
    if (!occ || !window.DATA[occ]) return;

    window.DATA[occ].forEach(function (group, i) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = group.label;
      manageEventSel.appendChild(o);
    });

    if (
      currentVal &&
      manageEventSel.querySelector(`option[value="${currentVal}"]`)
    ) {
      manageEventSel.value = currentVal;
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Create Occasion / Event
  // ══════════════════════════════════════════════════════════

  window.createNewOccasion = async function () {
    const persianName = document.getElementById("newOccasionName").value.trim();
    if (!persianName) return apToast("⚠️ نام مناسبت را وارد کنید");
    // کلید یکتا: occ_ + timestamp کوتاه
    const englishKey = "occ_" + Date.now().toString(36);

    try {
      apToast("⏳ در حال ذخیره در Firebase...");
      // ذخیره در Firebase
      await rtdb.ref("/labels/" + englishKey).set(persianName);
      // albums/englishKey را با یک placeholder ایجاد کن تا کلید وجود داشته باشد
      // (Firebase آبجکت خالی را ذخیره نمی‌کند — در صورت نبود رویداد، کلید وجود نخواهد داشت)

      window.DATA[englishKey] = [];
      window.LABELS[englishKey] = persianName;

      refreshAllSelectors();
      document.getElementById("newOccasionName").value = "";
      document.getElementById("newOccasionRef").value = "";
      apToast(`✅ مناسبت "${persianName}" ایجاد و در Firebase ذخیره شد`);
    } catch (err) {
      console.error(err);
      apToast("❌ خطا در ذخیره‌سازی");
    }
  };

  window.deleteOccasion = async function () {
    const key = document.getElementById("deleteOccasionSelector").value;
    if (!key) return apToast("⚠️ ابتدا مناسبتی را برای حذف انتخاب کنید");

    const events = window.DATA[key] || [];
    if (events.length > 0) {
      return apToast(`⛔ مناسبت "${window.LABELS[key] || key}" دارای ${events.length} رویداد است — ابتدا تمام رویدادها را حذف کنید`);
    }

    const label = window.LABELS[key] || key;
    if (!confirm(`آیا مطمئنید که مناسبت "${label}" حذف شود؟`)) return;

    try {
      apToast("⏳ در حال حذف از Firebase...");
      await rtdb.ref("/labels/" + key).remove();
      await rtdb.ref("/albums/" + key).remove();
      delete window.DATA[key];
      delete window.LABELS[key];
      refreshAllSelectors();
      // reset selector
      const sel = document.getElementById("deleteOccasionSelector");
      if (sel) { sel.innerHTML = '<option value="">انتخاب مناسبت برای حذف...</option>'; fillDeleteOccasionSelector(); }
      apToast(`✅ مناسبت "${label}" حذف شد`);
    } catch (err) {
      console.error(err);
      apToast("❌ خطا در حذف");
    }
  };

  function fillDeleteOccasionSelector() {
    const sel = document.getElementById("deleteOccasionSelector");
    if (!sel) return;
    sel.innerHTML = '<option value="">انتخاب مناسبت برای حذف...</option>';
    Object.keys(window.DATA || {}).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = (window.LABELS[key] || key) + (window.DATA[key].length > 0 ? ` (${window.DATA[key].length} رویداد)` : " (خالی)");
      sel.appendChild(opt);
    });
  }
  window.fillDeleteOccasionSelector = fillDeleteOccasionSelector;

  window.createNewEvent = async function () {
    const occ = document.getElementById("eventOccasionSelector").value;
    const label = document.getElementById("newEventName").value.trim();
    if (!occ) return apToast("مناسبت را انتخاب کنید");
    if (!label) return apToast("نام رویداد را وارد کنید");
    if (!window.DATA[occ]) window.DATA[occ] = [];

    try {
      apToast("⏳ در حال ذخیره در Firebase...");
      const key = fbKey();
      const order = window.DATA[occ].length;
      await rtdb.ref("/albums/" + occ + "/" + key).set({
        label: label,
        order: order,
        photos: {},
      });
      window.DATA[occ].push({ _fbKey: key, label: label, photos: [] });
      apToast(`✅ رویداد "${label}" اضافه و در Firebase ذخیره شد`);
      document.getElementById("newEventName").value = "";
      refreshAllSelectors();
    } catch (err) {
      console.error(err);
      apToast("❌ خطا در ذخیره‌سازی");
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Fetch Event Photos (برای پنل ادمین)
  // ══════════════════════════════════════════════════════════

  window.fetchEventPhotos = function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const event = window.DATA[occ][eventIdx];
    if (!event) return apToast("رویداد پیدا نشد");
    const photos = event.photos || [];

    apQueue = photos.map(function (p, idx) {
      return {
        id: "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        src: p.src,
        preview: p.src,
        title: p.title || "",
        status: "existing",
        srcOcc: occ,
        srcEventIdx: parseInt(eventIdx),
        photoIdx: idx,
        _fbPhotoKey: p._fbKey,
      };
    });

    if (apQueue.length === 0) {
      const grid = document.getElementById("adminPhotoGrid");
      if (grid)
        grid.innerHTML =
          '<p style="color:#a07850;font-size:0.85rem;padding:8px">این رویداد هنوز عکسی ندارد</p>';
      apToast(`رویداد "${event.label}" — بدون عکس`);
      return;
    }

    renderAdminPhotoGrid();
    apToast(`✅ رویداد "${event.label}" — ${apQueue.length} عکس`);
  };

  window.updateExistingPhotoTitle = function (
    occ,
    eventIdx,
    photoIdx,
    newTitle,
  ) {
    if (window.DATA[occ]?.[eventIdx]?.photos?.[photoIdx] !== undefined) {
      window.DATA[occ][eventIdx].photos[photoIdx].title = newTitle;
      // بروزرسانی در Firebase
      const ev = window.DATA[occ][eventIdx];
      const photo = ev.photos[photoIdx];
      if (ev._fbKey && photo._fbKey) {
        rtdb
          .ref(
            "/albums/" +
              occ +
              "/" +
              ev._fbKey +
              "/photos/" +
              photo._fbKey +
              "/title",
          )
          .set(newTitle);
      }
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Cloudinary Delete
  // ══════════════════════════════════════════════════════════

  async function cloudinaryDelete(srcUrl) {
    const cloudName = cfg("cloudName");
    const apiKey = cfg("apiKey");
    const apiSecret = cfg("apiSecret");
    if (!cloudName || !apiKey || !apiSecret) return "skip";

    const match = srcUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    const publicId = match ? match[1] : null;
    if (!publicId) return "error";

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const hashBuffer = await crypto.subtle.digest(
        "SHA-1",
        new TextEncoder().encode(strToSign),
      );
      const signature = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const fd = new FormData();
      fd.append("public_id", publicId);
      fd.append("timestamp", timestamp);
      fd.append("api_key", apiKey);
      fd.append("signature", signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        { method: "POST", body: fd },
      );
      const result = await res.json();
      return result.result === "ok" ? "ok" : "error";
    } catch (err) {
      console.error("Cloudinary delete error:", err);
      return "error";
    }
  }

  window.deleteExistingPhoto = async function (occ, eventIdx, photoIdx) {
    if (!confirm("این عکس از رویداد و کلودینری حذف شود؟")) return;
    if (!window.DATA[occ]?.[eventIdx]) return;

    const ev = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) return;

    // حذف از کلودینری
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok") apToast("🗑 عکس از کلودینری و آلبوم حذف شد");
    else if (r === "skip")
      apToast("🗑 عکس از آلبوم حذف شد (API Key/Secret تنظیم نشده)");
    else apToast("🗑 عکس از آلبوم حذف شد (خطا در کلودینری)");

    // حذف از Firebase
    if (ev._fbKey && photo._fbKey) {
      await deletePhotoFromFB(occ, ev._fbKey, photo._fbKey);
    }

    // حذف از حافظه محلی
    ev.photos.splice(photoIdx, 1);

    // بروزرسانی order عکس‌های باقیمانده در Firebase
    if (ev._fbKey) {
      const updates = {};
      ev.photos.forEach(function (p, idx) {
        if (p._fbKey)
          updates[
            "/albums/" +
              occ +
              "/" +
              ev._fbKey +
              "/photos/" +
              p._fbKey +
              "/order"
          ] = idx;
      });
      if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
    }

    window.fetchEventPhotos();
  };

  // ══════════════════════════════════════════════════════════
  //  Delete Entire Event
  // ══════════════════════════════════════════════════════════

  window.deleteEntireEvent = async function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("رویداد را انتخاب کنید");

    const event = window.DATA[occ][eventIdx];
    const label = event.label;
    const photos = event.photos || [];

    if (
      !confirm(
        `رویداد "${label}" و تمام ${photos.length} عکسش از سایت و کلودینری پاک شود؟`,
      )
    )
      return;

    if (photos.length > 0) {
      apToast(`⏳ در حال حذف ${photos.length} عکس از کلودینری...`);
      let ok = 0,
        skipped = 0,
        failed = 0;
      for (const photo of photos) {
        const r = await cloudinaryDelete(photo.src);
        if (r === "ok") ok++;
        else if (r === "skip") skipped++;
        else failed++;
      }
      if (skipped === photos.length)
        apToast(
          `🗑 رویداد "${label}" حذف شد (API Key/Secret تنظیم نشده — کلودینری دست‌نخورده)`,
        );
      else if (failed > 0)
        apToast(`⚠️ ${ok} عکس از کلودینری حذف شد — ${failed} با خطا`);
      else apToast(`✅ ${ok} عکس از کلودینری و رویداد "${label}" حذف شد`);
    } else {
      apToast(`🗑 رویداد "${label}" حذف شد`);
    }

    // حذف از Firebase
    if (event._fbKey) await deleteEventFromFB(occ, event._fbKey);

    // حذف از حافظه محلی
    window.DATA[occ].splice(parseInt(eventIdx), 1);
    await reorderEventsFB(occ);

    refreshAllSelectors();
  };

  // ══════════════════════════════════════════════════════════
  //  Toast
  // ══════════════════════════════════════════════════════════

  window.apToast = function (msg) {
    const t = document.getElementById("apToast");
    if (!t) return;
    t.style.display = "";
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove("show"), 4000);
  };

  // ══════════════════════════════════════════════════════════
  //  File Queue
  // ══════════════════════════════════════════════════════════

  window.handleFileSelect = function (e) {
    const imgs = [...e.target.files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return apToast("فایل تصویری انتخاب کنید");

    const progressWrap = document.getElementById("uploadProgressWrap");
    const progressBar = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl = document.getElementById("statusMessage");

    const total = imgs.length;
    let loaded = 0;

    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.style.background = "#c8923a";
    if (statusEl) statusEl.textContent = "";
    progressLabel.textContent =
      "\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 1 \u0627\u0632 " +
      total +
      "...";

    imgs.forEach(function (file) {
      const id = "q" + Date.now() + Math.random().toString(36).slice(2, 6);
      const reader = new FileReader();

      reader.onprogress = function (ev) {
        if (ev.lengthComputable) {
          const filePartial = ev.loaded / ev.total;
          const overallPct = Math.round(((loaded + filePartial) / total) * 100);
          progressBar.style.width = overallPct + "%";
        }
      };

      reader.onload = function (ev) {
        loaded++;
        apQueue.push({
          id,
          file,
          preview: ev.target.result,
          title: file.name.replace(/\.[^.]+$/, ""),
          status: "pending",
        });

        const pct = Math.round((loaded / total) * 100);
        progressBar.style.width = pct + "%";

        if (loaded < total) {
          progressLabel.textContent =
            "\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 " +
            (loaded + 1) +
            " \u0627\u0632 " +
            total +
            "...";
        } else {
          progressLabel.textContent =
            "\u2705 " +
            total +
            " \u0639\u06A9\u0633 \u0622\u0645\u0627\u062F\u0647 \u0622\u067E\u0644\u0648\u062F \u0628\u0647 \u06A9\u0644\u0648\u062F\u06CC\u0646\u0631\u06CC";
          progressBar.style.background = "#4caf50";
          setTimeout(function () {
            progressWrap.style.display = "none";
            progressBar.style.width = "0%";
            progressBar.style.background = "#c8923a";
            progressLabel.textContent = "";
          }, 1800);
        }

        renderAdminPhotoGrid();
      };

      reader.onerror = function () {
        loaded++;
        progressLabel.textContent =
          "\u26A0\uFE0F \u062E\u0637\u0627 \u062F\u0631 \u062E\u0648\u0627\u0646\u062F\u0646: " +
          file.name;
        if (loaded === total) {
          setTimeout(function () {
            progressWrap.style.display = "none";
          }, 2000);
        }
      };

      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  function renderAdminPhotoGrid() {
    const grid = document.getElementById("adminPhotoGrid");
    if (!grid) return;
    if (!apQueue.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = apQueue
      .map(function (p) {
        const s =
          p.status === "existing"
            ? '<div class="apg-badge apg-done">✓</div>'
            : p.status === "done"
              ? '<div class="apg-badge apg-done">✓</div>'
              : p.status === "uploading"
                ? '<div class="apg-badge apg-uploading">↑</div>'
                : p.status === "error"
                  ? '<div class="apg-badge apg-error">✗</div>'
                  : "";
        return `<div class="apg-item" id="apgitem-${p.id}">${s}<img src="${p.preview}" alt=""><input class="apg-title" type="text" value="${p.title.replace(/"/g, "&quot;")}" placeholder="عنوان عکس" onchange="updatePhotoTitle('${p.id}',this.value)"><button class="apg-del" onclick="removeFromQueue('${p.id}')" title="حذف">🗑</button></div>`;
      })
      .join("");
  }

  window.updatePhotoTitle = (id, title) => {
    const p = apQueue.find((x) => x.id === id);
    if (p) p.title = title;
  };
  window.removeFromQueue = (id) => {
    apQueue = apQueue.filter((p) => p.id !== id);
    renderAdminPhotoGrid();
  };
  window.clearPhotoQueue = () => {
    apQueue = [];
    renderAdminPhotoGrid();
    const s = document.getElementById("statusMessage");
    if (s) s.textContent = "";
  };

  // ══════════════════════════════════════════════════════════
  //  Upload to Cloudinary — و ذخیره مستقیم در Firebase
  // ══════════════════════════════════════════════════════════

  // ── متغیر کنترل توقف آپلود ──
  let _uploadCancelled = false;

  window.cancelUpload = function () {
    _uploadCancelled = true;
    apToast("⛔ آپلود در حال توقف...");
    const stopBtn = document.getElementById("stopUploadBtn");
    if (stopBtn) stopBtn.disabled = true;
  };

  window.uploadToCloudinary = async function () {
    const occ = document.getElementById("manageOccasionSelector")?.value || "";
    const eventIdx =
      document.getElementById("manageEventSelector")?.value ?? "";

    if (!occ) return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const toProcess = apQueue.filter(
      (p) => p.status === "pending" || p.status === "existing",
    );
    if (!toProcess.length) return apToast("هیچ عکسی در صف وجود ندارد");

    const existingPhotos = toProcess.filter((p) => p.status === "existing");
    const pendingPhotos = toProcess.filter((p) => p.status === "pending");

    if (existingPhotos.length > 0) {
      const srcOcc = existingPhotos[0].srcOcc;
      const srcEventIdx = existingPhotos[0].srcEventIdx;
      if (srcOcc === occ && String(srcEventIdx) === String(eventIdx)) {
        return apToast(
          "⚠️ مبدأ و مقصد یکسان است — مناسبت/رویداد مقصد را تغییر دهید",
        );
      }
    }

    // 🔒 بررسی شرط‌های آپلود جدید تغییر کرد: دیگر نیازی به چک کردن کلاینت‌ساید نیست، اما نام کلودینری را نگه می‌داریم
    if (pendingPhotos.length > 0) {
      if (!_cfg.cloudName) return apToast("Cloud Name تنظیم نشده است");
    }

    const progressWrap = document.getElementById("uploadProgressWrap");
    const progressBar = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl = document.getElementById("statusMessage");
    const stopBtn = document.getElementById("stopUploadBtn");

    // فعال‌سازی دکمه توقف
    _uploadCancelled = false;
    if (stopBtn) { stopBtn.style.display = "inline-flex"; stopBtn.disabled = false; }

    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    let done = 0,
      total = toProcess.length;
    let successCount = 0,
      errorCount = 0;

    const ev = window.DATA[occ][parseInt(eventIdx)];
    if (!ev._fbKey) {
      const key = fbKey();
      await rtdb
        .ref("/albums/" + occ + "/" + key)
        .set({ label: ev.label, order: parseInt(eventIdx), photos: {} });
      ev._fbKey = key;
    }

    // ── تابع آپلود یک عکس به کلودینری (با امضای اختصاصی) ──
    async function uploadSinglePhoto(photo, idx) {
      if (_uploadCancelled) return "cancelled";

      photo.status = "uploading";
      renderAdminPhotoGrid();
      progressLabel.textContent = `آپلود ${idx + 1} از ${total}: ${photo.title || "بدون عنوان"}`;

      try {
        // دریافت امضای جداگانه برای هر عکس
        // ارسال context به سرور تا در امضا گنجانده شود
        const contextVal = photo.title ? `caption=${photo.title}` : null;
        const sigResponse = await fetch(
          `${FUNCTIONS_BASE_URL}/getCloudinarySignature`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              upload_preset: _cfg.preset || "ml_default",
              ...(contextVal ? { context: contextVal } : {}),
            }),
          }
        );

        if (!sigResponse.ok) {
          const errText = await sigResponse.text();
          throw new Error(`سرور پاسخ داد ${sigResponse.status}: ${errText}`);
        }

        const sigData = await sigResponse.json();
        if (!sigData.success) {
          throw new Error(sigData.error || "خطا در دریافت امضا از سرور");
        }

        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("api_key", sigData.api_key);
        formData.append("timestamp", sigData.timestamp);
        formData.append("signature", sigData.signature);
        formData.append("upload_preset", _cfg.preset || "ml_default");
        if (sigData.context) formData.append("context", sigData.context);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`,
          { method: "POST", body: formData }
        );

        const data = await res.json();

        if (data.secure_url) {
          const newPhotoData = { src: data.secure_url, title: photo.title };
          window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);
          await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);
          photo.status = "done";
          return "success";
        } else {
          const cloudErr = data.error?.message || JSON.stringify(data);
          console.error("❌ Cloudinary error:", cloudErr);
          throw new Error(cloudErr);
        }
      } catch (err) {
        console.error(`❌ آپلود ${photo.title} شکست خورد:`, err.message);
        photo.status = "error";
        return "error";
      }
    }

    // ── انتقال عکس‌های موجود (sequential چون Firebase write است) ──
    for (const photo of toProcess.filter(p => p.status === "existing")) {
      if (_uploadCancelled) break;
      progressLabel.textContent = `انتقال: ${photo.title}`;
      const srcEv = window.DATA[photo.srcOcc]?.[photo.srcEventIdx];
      const srcArr = srcEv?.photos;
      if (!window.DATA[occ][parseInt(eventIdx)].photos)
        window.DATA[occ][parseInt(eventIdx)].photos = [];
      const newPhotoData = { src: photo.src, title: photo.title };
      window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);
      await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);
      if (srcEv?._fbKey && photo._fbPhotoKey)
        await deletePhotoFromFB(photo.srcOcc, srcEv._fbKey, photo._fbPhotoKey);
      if (srcArr) {
        const idx = srcArr.findIndex((x) => x.src === photo.src);
        if (idx !== -1) srcArr.splice(idx, 1);
      }
      photo.status = "done";
      successCount++;
      done++;
      progressBar.style.width = Math.round((done / total) * 100) + "%";
      renderAdminPhotoGrid();
    }

    // ── آپلود موازی عکس‌های جدید (۳ تا همزمان) ──
    const pendingQueue = toProcess.filter(p => p.status === "pending" || p.status === "uploading");
    const CONCURRENCY = 3;

    async function runBatch(batch, startIdx) {
      const results = await Promise.all(
        batch.map((photo, i) => uploadSinglePhoto(photo, startIdx + i))
      );
      results.forEach(r => {
        if (r === "success") successCount++;
        else if (r === "error") errorCount++;
        done++;
        progressBar.style.width = Math.round((done / total) * 100) + "%";
        renderAdminPhotoGrid();
      });
    }

    for (let i = 0; i < pendingQueue.length; i += CONCURRENCY) {
      if (_uploadCancelled) {
        apToast(`⛔ آپلود متوقف شد. موفق: ${successCount} | خطا: ${errorCount}`);
        if (stopBtn) stopBtn.style.display = "none";
        return;
      }
      const batch = pendingQueue.slice(i, i + CONCURRENCY);
      await runBatch(batch, i);
    }

    // مخفی کردن دکمه توقف بعد از اتمام
    if (stopBtn) stopBtn.style.display = "none";
    apToast(`✅ عملیات پایان یافت. موفق: ${successCount} | خطا: ${errorCount}`);
  };

  // ══════════════════════════════════════════════════════════
  //  Admin Overlay Close
  // ══════════════════════════════════════════════════════════

  // overlay click handled via onclick in HTML
})();

// ══════════════════════════════════════════════════════════
//  Tab Switcher
// ══════════════════════════════════════════════════════════

function switchAdminTab(tabName) {
  const uploadsContent = document.getElementById("tab-uploads");
  const settingsContent = document.getElementById("tab-settings");
  const btnUploads = document.getElementById("btnTabUploads");
  const btnSettings = document.getElementById("btnTabSettings");

  if (tabName === "uploads") {
    uploadsContent.style.display = "block";
    settingsContent.style.display = "none";
    btnUploads.classList.add("active");
    btnUploads.style.borderBottomColor = "var(--gold)";
    btnUploads.style.color = "var(--brown-dark)";
    btnUploads.style.fontWeight = "600";
    btnSettings.classList.remove("active");
    btnSettings.style.borderBottomColor = "transparent";
    btnSettings.style.color = "var(--text-muted)";
    btnSettings.style.fontWeight = "500";
  } else {
    uploadsContent.style.display = "none";
    settingsContent.style.display = "block";
    btnSettings.classList.add("active");
    btnSettings.style.borderBottomColor = "var(--gold)";
    btnSettings.style.color = "var(--brown-dark)";
    btnSettings.style.fontWeight = "600";
    btnUploads.classList.remove("active");
    btnUploads.style.borderBottomColor = "transparent";
    btnUploads.style.color = "var(--text-muted)";
    btnUploads.style.fontWeight = "500";
  }
}
