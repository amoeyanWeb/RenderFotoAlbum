/* ════════════════════════════════════════════════════════════
   app.js — نسخه Firebase
   تمام داده‌ها (عکس‌ها، رویدادها، مناسبت‌ها) در Firebase RTDB
   نیازی به data.js نیست — هر تغییر مستقیم در دیتابیس ذخیره می‌شود
   ════════════════════════════════════════════════════════════ */
(function () {

  // ══════════════════════════════════════════════════════════
  //  ⚙️  تنظیمات Firebase و Cloudinary
  // ══════════════════════════════════════════════════════════

  const firebaseConfig = {
    apiKey: "AIzaSyCNetG7kzLaOiX1PF93tx1B7nLWm-2By_8",
    authDomain: "fotoalbum-ac441.firebaseapp.com",
    databaseURL: "https://fotoalbum-ac441-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fotoalbum-ac441",
    storageBucket: "fotoalbum-ac441.firebasestorage.app",
    messagingSenderId: "547954410485",
    appId: "1:547954410485:web:2f3a1b4c90f5d7bdf8d6bc",
    measurementId: "G-CDPYPS3EH5",
  };

  const CONFIG = {
    cloudName: "delf4luxo",
    uploadPreset: "ml_default",
    apiKey: "925938693554627",
    apiSecret: "FEnSdhP9qa7qx9X882awdUfJbJ4",
  };

  // ══════════════════════════════════════════════════════════
  //  پایین این خط نیاز به تغییر ندارد
  // ══════════════════════════════════════════════════════════

  // ── Firebase init ──
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();

  // ── حافظه محلی (کش) ──
  // DATA: { [occasion]: [ { label, photos: [{src, title}] } ] }  — آرایه‌ای مانند قبل
  window.DATA   = {};
  window.LABELS = {};

  let _cfg = {
    cloudName:  CONFIG.cloudName,
    preset:     CONFIG.uploadPreset,
    apiKey:     CONFIG.apiKey,
    apiSecret:  CONFIG.apiSecret,
    sysUser: "", sysPass: "",
    adminUser: "", adminPass: "",
  };

  function cfg(k)      { return _cfg[k] || ""; }
  function setCfg(k,v) { _cfg[k] = v; }

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
        photos: fbPhotosToArray(ev.photos)
      }));
  }

  function fbPhotosToArray(photosObj) {
    if (!photosObj) return [];
    return Object.entries(photosObj)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([key, p]) => ({
        _fbKey: key,
        src: p.src || "",
        title: p.title || ""
      }));
  }

  // تولید کلید یکتا برای Firebase
  function fbKey() {
    return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // بارگذاری کامل داده‌ها از Firebase
  async function loadAllData() {
    const [labelsSnap, albumsSnap, credsSnap] = await Promise.all([
      rtdb.ref("/labels").once("value"),
      rtdb.ref("/albums").once("value"),
      rtdb.ref("/").once("value")
    ]);

    const labelsRaw = labelsSnap.val() || {};
    const albumsRaw = albumsSnap.val() || {};
    const creds     = credsSnap.val() || {};

    window.LABELS = labelsRaw;
    window.DATA   = {};

    Object.keys(albumsRaw).forEach(function(occ) {
      window.DATA[occ] = fbEventsToArray(albumsRaw[occ]);
    });

    _cfg.sysUser   = creds.systemUsername  || "";
    _cfg.sysPass   = creds.systemPassword  || "";
    _cfg.adminUser = creds.adminUsername   || "";
    _cfg.adminPass = creds.adminPassword   || "";

    return true;
  }

  // ذخیره credentials در Firebase
  async function saveCredentialsToFirebase(updates) {
    try { await rtdb.ref("/").update(updates); return true; }
    catch(err) { console.error("Firebase RTDB write error:", err); return false; }
  }

  // ذخیره یک رویداد در Firebase (ایجاد یا بروزرسانی)
  async function saveEventToFB(occ, eventIdx) {
    const ev = window.DATA[occ][eventIdx];
    if (!ev) return;
    const key = ev._fbKey || ("e" + eventIdx);

    const photosObj = {};
    (ev.photos || []).forEach(function(p, pIdx) {
      const pKey = p._fbKey || ("p" + pIdx);
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
    await rtdb.ref("/albums/" + occ + "/" + eventFbKey + "/photos/" + photoFbKey).remove();
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
      order: order
    });
    photoData._fbKey = pKey;
  }

  // بروزرسانی order رویدادها بعد از splice
  async function reorderEventsFB(occ) {
    const updates = {};
    (window.DATA[occ] || []).forEach(function(ev, idx) {
      if (ev._fbKey) updates["/albums/" + occ + "/" + ev._fbKey + "/order"] = idx;
    });
    if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
  }

  // ══════════════════════════════════════════════════════════
  //  بارگذاری اولیه
  // ══════════════════════════════════════════════════════════

  let _dataLoaded = false;
  let _dataCallbacks = [];

  function onDataReady(cb) {
    if (_dataLoaded) { cb(); return; }
    _dataCallbacks.push(cb);
  }

  loadAllData().then(function() {
    _dataLoaded = true;
    window._dataLoaded = true;
    _dataCallbacks.forEach(function(cb) { cb(); });
    _dataCallbacks = [];
    // بعد از لود، پنجره لاگین را نشان بده
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.setProperty("display", "flex", "important");
  }).catch(function(err) {
    console.error("Firebase load error:", err);
    _dataLoaded = true;
    window._dataLoaded = true;
    _dataCallbacks.forEach(function(cb) { cb(); });
    _dataCallbacks = [];
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.setProperty("display", "flex", "important");
  });

  // ══════════════════════════════════════════════════════════
  //  System Login
  // ══════════════════════════════════════════════════════════

  window.doSystemLogin = function () {
    const u = document.getElementById("lgUser").value.trim();
    const p = document.getElementById("lgPass").value;
    const errEl = document.getElementById("lgErr");
    errEl.textContent = "";

    if (!_dataLoaded) {
      errEl.textContent = "⏳ در حال اتصال به سرور...";
      onDataReady(function() { window.doSystemLogin(); });
      return;
    }

    if (u === cfg("sysUser") && p === cfg("sysPass")) {
      document.getElementById("initialLoginModal").style.display = "none";
      sessionStorage.setItem("initialLoggedIn", "true");
      if (typeof fillOccasionSelector === "function") {
        fillOccasionSelector(document.getElementById("selOccasion"), "— انتخاب مناسبت —");
      }
    } else {
      errEl.textContent = "نام کاربری یا رمز اشتباه است";
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

    // session قدیمی را پاک کن — باید دوباره لاگین کند
    sessionStorage.removeItem("initialLoggedIn");

    const myToast = document.getElementById("apToast");
    if (myToast) myToast.style.display = "none";

    // Modal را فوری مخفی نگه دار تا داده‌ها لود شوند
    // (بعد از loadAllData نمایش داده می‌شود)
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.display = "none";
  });

  // ══════════════════════════════════════════════════════════
  //  Admin Panel Open/Close
  // ══════════════════════════════════════════════════════════

  window.openAdmin = function () {
    if (sessionStorage.getItem("initialLoggedIn") !== "true") {
      const systemModal = document.getElementById("initialLoginModal");
      if (systemModal) systemModal.style.setProperty("display", "flex", "important");
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

  window.doAdminLogin = function () {
    const u = document.getElementById("adUser").value.trim();
    const p = document.getElementById("adPass").value;
    const errEl = document.getElementById("adErr");
    errEl.textContent = "";

    if (!_dataLoaded) {
      errEl.textContent = "⏳ در حال اتصال به سرور...";
      onDataReady(function() { window.doAdminLogin(); });
      return;
    }

    if (u !== cfg("adminUser") || p !== cfg("adminPass")) {
      errEl.textContent = "نام کاربری یا رمز اشتباه است";
      return;
    }

    document.getElementById("loginCard").style.display = "none";

    const overlay = document.getElementById("adminOverlay");
    if (overlay) overlay.style.display = "block";

    const adminPanel = document.getElementById("adminPanel");
    adminPanel.style.display = "flex";
    adminPanel.style.flexDirection = "column";
    adminPanel.style.position = "fixed";
    adminPanel.style.top = "50%";
    adminPanel.style.left = "50%";
    adminPanel.style.transform = "translate(-50%, -50%)";
    adminPanel.style.margin = "0";
    adminPanel.style.zIndex = "10000";
    adminPanel.style.background = "#fff";
    adminPanel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    adminPanel.style.maxHeight = "85vh";
    adminPanel.style.width = "90%";
    adminPanel.style.maxWidth = "780px";
    adminPanel.style.borderRadius = "12px";

    initAdminPanel();
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

    const cnEl  = document.getElementById("cfgCloudName");
    const prEl  = document.getElementById("cfgPreset");
    const keyEl = document.getElementById("cfgApiKey");
    const secEl = document.getElementById("cfgApiSecret");
    if (cnEl)  cnEl.value  = cfg("cloudName");
    if (prEl)  prEl.value  = cfg("preset");
    if (keyEl) keyEl.value = cfg("apiKey");
    if (secEl) secEl.value = cfg("apiSecret");
    const cfgStatus = document.getElementById("cfgStatus");
    if (cfgStatus) cfgStatus.textContent = "";
  }

  // ══════════════════════════════════════════════════════════
  //  Cloudinary Settings
  // ══════════════════════════════════════════════════════════

  window.saveCloudinarySettings = function () {
    const cloudName = (document.getElementById("cfgCloudName").value || "").trim();
    const preset    = (document.getElementById("cfgPreset").value    || "").trim();
    const apiKey    = (document.getElementById("cfgApiKey").value    || "").trim();
    const apiSecret = (document.getElementById("cfgApiSecret").value || "").trim();

    if (!cloudName) return showCfgStatus("⚠️ Cloud Name را وارد کنید", "red");
    if (!preset)    return showCfgStatus("⚠️ Upload Preset را وارد کنید", "red");

    setCfg("cloudName", cloudName);
    setCfg("preset",    preset);
    if (apiKey)    setCfg("apiKey",    apiKey);
    if (apiSecret) setCfg("apiSecret", apiSecret);

    showCfgStatus("✅ تنظیمات ذخیره شد (تا بستن مرورگر)", "green");
  };

  function showCfgStatus(msg, color) {
    const el = document.getElementById("cfgStatus");
    if (!el) return;
    el.textContent = msg;
    el.style.color = color;
    setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 3000);
  }

  // ══════════════════════════════════════════════════════════
  //  Password Modal
  // ══════════════════════════════════════════════════════════

  window.openPwdModal = function (type) {
    pwdTargetType = type;
    document.getElementById("pwdModalTitle").textContent =
      type === "system" ? "🔐 تغییر رمز ورود به سیستم" : "🔑 تغییر رمز پنل ادمین";
    document.getElementById("pwdModalDesc").textContent =
      type === "system" ? "اطلاعات فعلی و جدید را وارد کنید" : "اطلاعات ورود ادمین را وارد کنید";
    ["pwdNewUser","pwdCurrentPass","pwdNewPass","pwdConfirmPass"].forEach(function(id) {
      document.getElementById(id).value = "";
    });
    document.getElementById("pwdErr").textContent = "";
    document.getElementById("pwdChangeOverlay").classList.add("open");
  };

  window.closePwdModal = function () {
    var errEl = document.getElementById("pwdErr");
    if (errEl) { errEl.textContent = ""; errEl.style.color = ""; }
    ["pwdNewUser","pwdCurrentPass","pwdNewPass","pwdConfirmPass"].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });
    var applyBtn = document.getElementById("pwdApplyBtn");
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = "تغییر"; }
    document.getElementById("pwdChangeOverlay").classList.remove("open");
    pwdTargetType = "";
  };

  window.applyPwdChange = async function () {
    const newUser     = document.getElementById("pwdNewUser").value.trim();
    const currentPass = document.getElementById("pwdCurrentPass").value;
    const newPass     = document.getElementById("pwdNewPass").value;
    const confirmPass = document.getElementById("pwdConfirmPass").value;
    const errEl       = document.getElementById("pwdErr");
    const applyBtn    = document.getElementById("pwdApplyBtn");
    errEl.textContent = "";
    errEl.style.color = "";

    if (!newUser) { errEl.textContent = "⚠️ نام کاربری جدید را وارد کنید"; return; }

    const uKey = pwdTargetType === "system" ? "sysUser" : "adminUser";
    const pKey = pwdTargetType === "system" ? "sysPass" : "adminPass";

    if (currentPass !== cfg(pKey)) { errEl.textContent = "⚠️ رمز عبور فعلی اشتباه است"; return; }
    if (newPass.length < 6)        { errEl.textContent = "⚠️ رمز جدید باید حداقل ۶ کاراکتر باشد"; return; }
    if (newPass !== confirmPass)    { errEl.textContent = "⚠️ رمز جدید و تکرار آن مطابقت ندارند"; return; }

    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = "⏳ در حال ذخیره..."; }

    const fbUpdates = pwdTargetType === "system"
      ? { systemUsername: newUser, systemPassword: newPass }
      : { adminUsername: newUser, adminPassword: newPass };

    const ok = await saveCredentialsToFirebase(fbUpdates);
    if (ok) {
      setCfg(uKey, newUser); setCfg(pKey, newPass);
      closePwdModal();
      apToast("✅ اطلاعات ورود با موفقیت در Firebase ذخیره شد");
    } else {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = "تغییر"; }
      errEl.textContent = "❌ خطا در ذخیره‌سازی — لطفاً دوباره تلاش کنید";
      errEl.style.color = "red";
    }
  };

  document.addEventListener("DOMContentLoaded", function() {
    var pwdOverlay = document.getElementById("pwdChangeOverlay");
    if (pwdOverlay) {
      pwdOverlay.addEventListener("click", function(e) {
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
    Object.keys(window.DATA).forEach(function(key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = window.LABELS[key] || key;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  window.fillOccasionSelector = fillOccasionSel;

  function refreshAllSelectors() {
    ["eventOccasionSelector","manageOccasionSelector","selOccasion"].forEach(function(id) {
      const sel = document.getElementById(id);
      if (!sel) return;
      const placeholder = id === "selOccasion" ? "— انتخاب مناسبت —" : "انتخاب مناسبت...";
      fillOccasionSel(sel, placeholder);
    });
    if (typeof window.updateEventSelector === "function") window.updateEventSelector();
  }

  window.updateEventSelector = function () {
    const manageOccasionSel = document.getElementById("manageOccasionSelector");
    const manageEventSel    = document.getElementById("manageEventSelector");
    if (!manageOccasionSel || !manageEventSel) return;

    const occ      = manageOccasionSel.value;
    const currentVal = manageEventSel.value;

    manageEventSel.innerHTML = '<option value="">انتخاب رویداد...</option>';
    if (!occ || !window.DATA[occ]) return;

    window.DATA[occ].forEach(function(group, i) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = group.label;
      manageEventSel.appendChild(o);
    });

    if (currentVal && manageEventSel.querySelector(`option[value="${currentVal}"]`)) {
      manageEventSel.value = currentVal;
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Create Occasion / Event
  // ══════════════════════════════════════════════════════════

  window.createNewOccasion = async function () {
    const persianName = document.getElementById("newOccasionName").value.trim();
    let   englishKey  = document.getElementById("newOccasionRef").value.trim().toLowerCase();
    if (!persianName) return apToast("نام فارسی را وارد کنید");
    if (!englishKey) englishKey = persianName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
    if (window.DATA[englishKey]) return apToast("این مناسبت وجود دارد");

    try {
      apToast("⏳ در حال ذخیره در Firebase...");
      // ذخیره در Firebase
      await rtdb.ref("/labels/" + englishKey).set(persianName);
      // albums/englishKey را با یک placeholder ایجاد کن تا کلید وجود داشته باشد
      // (Firebase آبجکت خالی را ذخیره نمی‌کند — در صورت نبود رویداد، کلید وجود نخواهد داشت)

      window.DATA[englishKey]   = [];
      window.LABELS[englishKey] = persianName;

      refreshAllSelectors();
      document.getElementById("newOccasionName").value = "";
      document.getElementById("newOccasionRef").value  = "";
      apToast(`✅ مناسبت "${persianName}" ایجاد و در Firebase ذخیره شد`);
    } catch(err) {
      console.error(err);
      apToast("❌ خطا در ذخیره‌سازی");
    }
  };

  window.createNewEvent = async function () {
    const occ   = document.getElementById("eventOccasionSelector").value;
    const label = document.getElementById("newEventName").value.trim();
    if (!occ)   return apToast("مناسبت را انتخاب کنید");
    if (!label) return apToast("نام رویداد را وارد کنید");
    if (!window.DATA[occ]) window.DATA[occ] = [];

    try {
      apToast("⏳ در حال ذخیره در Firebase...");
      const key = fbKey();
      const order = window.DATA[occ].length;
      await rtdb.ref("/albums/" + occ + "/" + key).set({
        label: label,
        order: order,
        photos: {}
      });
      window.DATA[occ].push({ _fbKey: key, label: label, photos: [] });
      apToast(`✅ رویداد "${label}" اضافه و در Firebase ذخیره شد`);
      document.getElementById("newEventName").value = "";
      refreshAllSelectors();
    } catch(err) {
      console.error(err);
      apToast("❌ خطا در ذخیره‌سازی");
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Fetch Event Photos (برای پنل ادمین)
  // ══════════════════════════════════════════════════════════

  window.fetchEventPhotos = function () {
    const occ      = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ)            return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const event  = window.DATA[occ][eventIdx];
    if (!event) return apToast("رویداد پیدا نشد");
    const photos = event.photos || [];

    apQueue = photos.map(function(p, idx) {
      return {
        id: "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
        src: p.src,
        preview: p.src,
        title: p.title || "",
        status: "existing",
        srcOcc: occ,
        srcEventIdx: parseInt(eventIdx),
        photoIdx: idx,
        _fbPhotoKey: p._fbKey
      };
    });

    if (apQueue.length === 0) {
      const grid = document.getElementById("adminPhotoGrid");
      if (grid) grid.innerHTML = '<p style="color:#a07850;font-size:0.85rem;padding:8px">این رویداد هنوز عکسی ندارد</p>';
      apToast(`رویداد "${event.label}" — بدون عکس`);
      return;
    }

    renderAdminPhotoGrid();
    apToast(`✅ رویداد "${event.label}" — ${apQueue.length} عکس`);
  };

  window.updateExistingPhotoTitle = function (occ, eventIdx, photoIdx, newTitle) {
    if (window.DATA[occ]?.[eventIdx]?.photos?.[photoIdx] !== undefined) {
      window.DATA[occ][eventIdx].photos[photoIdx].title = newTitle;
      // بروزرسانی در Firebase
      const ev = window.DATA[occ][eventIdx];
      const photo = ev.photos[photoIdx];
      if (ev._fbKey && photo._fbKey) {
        rtdb.ref("/albums/" + occ + "/" + ev._fbKey + "/photos/" + photo._fbKey + "/title").set(newTitle);
      }
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Cloudinary Delete
  // ══════════════════════════════════════════════════════════

  async function cloudinaryDelete(srcUrl) {
    const cloudName = cfg("cloudName");
    const apiKey    = cfg("apiKey");
    const apiSecret = cfg("apiSecret");
    if (!cloudName || !apiKey || !apiSecret) return "skip";

    const match    = srcUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    const publicId = match ? match[1] : null;
    if (!publicId) return "error";

    try {
      const timestamp  = Math.floor(Date.now() / 1000);
      const strToSign  = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(strToSign));
      const signature  = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,"0")).join("");

      const fd = new FormData();
      fd.append("public_id", publicId);
      fd.append("timestamp",  timestamp);
      fd.append("api_key",    apiKey);
      fd.append("signature",  signature);

      const res    = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: fd });
      const result = await res.json();
      return result.result === "ok" ? "ok" : "error";
    } catch(err) {
      console.error("Cloudinary delete error:", err);
      return "error";
    }
  }

  window.deleteExistingPhoto = async function (occ, eventIdx, photoIdx) {
    if (!confirm("این عکس از رویداد و کلودینری حذف شود؟")) return;
    if (!window.DATA[occ]?.[eventIdx]) return;

    const ev    = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) return;

    // حذف از کلودینری
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok") apToast("🗑 عکس از کلودینری و آلبوم حذف شد");
    else if (r === "skip") apToast("🗑 عکس از آلبوم حذف شد (API Key/Secret تنظیم نشده)");
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
      ev.photos.forEach(function(p, idx) {
        if (p._fbKey) updates["/albums/" + occ + "/" + ev._fbKey + "/photos/" + p._fbKey + "/order"] = idx;
      });
      if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
    }

    window.fetchEventPhotos();
  };

  // ══════════════════════════════════════════════════════════
  //  Delete Entire Event
  // ══════════════════════════════════════════════════════════

  window.deleteEntireEvent = async function () {
    const occ      = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ)            return apToast("مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("رویداد را انتخاب کنید");

    const event  = window.DATA[occ][eventIdx];
    const label  = event.label;
    const photos = event.photos || [];

    if (!confirm(`رویداد "${label}" و تمام ${photos.length} عکسش از سایت و کلودینری پاک شود؟`)) return;

    if (photos.length > 0) {
      apToast(`⏳ در حال حذف ${photos.length} عکس از کلودینری...`);
      let ok = 0, skipped = 0, failed = 0;
      for (const photo of photos) {
        const r = await cloudinaryDelete(photo.src);
        if (r === "ok") ok++;
        else if (r === "skip") skipped++;
        else failed++;
      }
      if (skipped === photos.length)
        apToast(`🗑 رویداد "${label}" حذف شد (API Key/Secret تنظیم نشده — کلودینری دست‌نخورده)`);
      else if (failed > 0)
        apToast(`⚠️ ${ok} عکس از کلودینری حذف شد — ${failed} با خطا`);
      else
        apToast(`✅ ${ok} عکس از کلودینری و رویداد "${label}" حذف شد`);
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
    t.textContent   = msg;
    t.classList.add("show");
    clearTimeout(t._tid);
    t._tid = setTimeout(()=>t.classList.remove("show"), 4000);
  };

  // ══════════════════════════════════════════════════════════
  //  File Queue
  // ══════════════════════════════════════════════════════════

  window.handleFileSelect = function (e) {
    const imgs = [...e.target.files].filter(f=>f.type.startsWith("image/"));
    if (!imgs.length) return apToast("فایل تصویری انتخاب کنید");
    imgs.forEach(function(file) {
      const id     = "q" + Date.now() + Math.random().toString(36).slice(2,6);
      const reader = new FileReader();
      reader.onload = function(ev) {
        apQueue.push({ id, file, preview: ev.target.result, title: file.name.replace(/\.[^.]+$/,""), status: "pending" });
        renderAdminPhotoGrid();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  function renderAdminPhotoGrid() {
    const grid = document.getElementById("adminPhotoGrid");
    if (!grid) return;
    if (!apQueue.length) { grid.innerHTML = ""; return; }
    grid.innerHTML = apQueue.map(function(p) {
      const s = p.status === "existing" ? '<div class="apg-badge apg-done">✓</div>'
              : p.status === "done"     ? '<div class="apg-badge apg-done">✓</div>'
              : p.status === "uploading"? '<div class="apg-badge apg-uploading">↑</div>'
              : p.status === "error"    ? '<div class="apg-badge apg-error">✗</div>'
              : "";
      return `<div class="apg-item" id="apgitem-${p.id}">${s}<img src="${p.preview}" alt=""><input class="apg-title" type="text" value="${p.title.replace(/"/g,"&quot;")}" placeholder="عنوان عکس" onchange="updatePhotoTitle('${p.id}',this.value)"><button class="apg-del" onclick="removeFromQueue('${p.id}')" title="حذف">🗑</button></div>`;
    }).join("");
  }

  window.updatePhotoTitle  = (id, title) => { const p = apQueue.find(x=>x.id===id); if (p) p.title = title; };
  window.removeFromQueue   = (id)         => { apQueue = apQueue.filter(p=>p.id!==id); renderAdminPhotoGrid(); };
  window.clearPhotoQueue   = ()           => { apQueue = []; renderAdminPhotoGrid(); const s = document.getElementById("statusMessage"); if (s) s.textContent=""; };

  // ══════════════════════════════════════════════════════════
  //  Upload to Cloudinary — و ذخیره مستقیم در Firebase
  // ══════════════════════════════════════════════════════════

  window.uploadToCloudinary = async function () {
    const occ      = document.getElementById("manageOccasionSelector")?.value || "";
    const eventIdx = document.getElementById("manageEventSelector")?.value ?? "";

    if (!occ)            return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const toProcess     = apQueue.filter(p => p.status === "pending" || p.status === "existing");
    if (!toProcess.length) return apToast("هیچ عکسی در صف وجود ندارد");

    const existingPhotos = toProcess.filter(p => p.status === "existing");
    const pendingPhotos  = toProcess.filter(p => p.status === "pending");

    if (existingPhotos.length > 0) {
      const srcOcc      = existingPhotos[0].srcOcc;
      const srcEventIdx = existingPhotos[0].srcEventIdx;
      if (srcOcc === occ && String(srcEventIdx) === String(eventIdx)) {
        return apToast("⚠️ مبدأ و مقصد یکسان است — مناسبت/رویداد مقصد را تغییر دهید");
      }
    }

    if (pendingPhotos.length > 0) {
      if (!cfg("cloudName")) return apToast("Cloud Name تنظیم نشده");
      if (!cfg("preset"))    return apToast("Upload Preset تنظیم نشده");
    }

    const progressWrap  = document.getElementById("uploadProgressWrap");
    const progressBar   = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl      = document.getElementById("statusMessage");

    progressWrap.style.display = "block";
    progressBar.style.width    = "0%";
    let done = 0, total = toProcess.length;
    let successCount = 0, errorCount = 0;

    const ev = window.DATA[occ][parseInt(eventIdx)];
    if (!ev._fbKey) {
      // رویداد هنوز در Firebase ثبت نشده — ابتدا ذخیره‌اش کن
      const key = fbKey();
      await rtdb.ref("/albums/" + occ + "/" + key).set({ label: ev.label, order: parseInt(eventIdx), photos: {} });
      ev._fbKey = key;
    }

    for (const photo of toProcess) {

      // ── حالت ۱: عکس موجود (انتقال بین رویدادها) ──
      if (photo.status === "existing") {
        progressLabel.textContent = `انتقال ${done + 1} از ${total}: ${photo.title}`;

        const srcEv  = window.DATA[photo.srcOcc]?.[photo.srcEventIdx];
        const srcArr = srcEv?.photos;

        if (!window.DATA[occ][parseInt(eventIdx)].photos) window.DATA[occ][parseInt(eventIdx)].photos = [];

        const newPhotoData = { src: photo.src, title: photo.title };
        window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);

        // ذخیره در Firebase مقصد
        await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);

        // حذف از Firebase مبدأ
        if (srcEv?._fbKey && photo._fbPhotoKey) {
          await deletePhotoFromFB(photo.srcOcc, srcEv._fbKey, photo._fbPhotoKey);
        }

        // حذف از حافظه محلی مبدأ
        if (srcArr) {
          const idx = srcArr.findIndex(x => x.src === photo.src);
          if (idx !== -1) srcArr.splice(idx, 1);
        }

        photo.status = "done";
        successCount++;

      // ── حالت ۲: عکس جدید (آپلود به کلودینری + ذخیره در Firebase) ──
      } else if (photo.status === "pending") {
        photo.status = "uploading";
        renderAdminPhotoGrid();
        progressLabel.textContent = `آپلود ${done + 1} از ${total}: ${photo.title}`;
        try {
          const formData = new FormData();
          formData.append("file",           photo.file);
          formData.append("upload_preset",  cfg("preset"));
          formData.append("context",        `caption=${photo.title}`);

          const res  = await fetch(`https://api.cloudinary.com/v1_1/${cfg("cloudName")}/image/upload`, { method: "POST", body: formData });
          const data = await res.json();

          if (data.secure_url) {
            const newPhotoData = { src: data.secure_url, title: photo.title };
            window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);

            // ذخیره مستقیم در Firebase — بدون نیاز به دانلود data.js
            await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);

            photo.status = "done";
            successCount++;
          } else {
            photo.status = "error";
            errorCount++;
            console.error("Cloudinary error:", data);
          }
        } catch(err) {
          photo.status = "error";
          errorCount++;
          console.error("Upload failed:", err);
        }
      }

      done++;
      progressBar.style.width = Math.round((done / total) * 100) + "%";
      renderAdminPhotoGrid();
    }

    const hadExisting = existingPhotos.length > 0;
    const hadPending  = pendingPhotos.length  > 0;

    progressLabel.textContent = hadExisting && !hadPending ? "انتقال تمام شد" : "آپلود تمام شد ✅";
    statusEl.textContent =
      (hadExisting ? `✅ ${existingPhotos.length} عکس منتقل شد` : "") +
      (hadPending  ? ` ✅ ${pendingPhotos.filter(p=>p.status==="done").length} عکس آپلود شد` : "") +
      (errorCount  ? ` — ❌ ${errorCount} خطا` : "");

    apToast(hadExisting && !hadPending
      ? `✅ ${successCount} عکس با موفقیت منتقل شد`
      : `✅ ${successCount} عکس با موفقیت در Firebase ذخیره شد`
    );

    apQueue = [];
    renderAdminPhotoGrid();
    setTimeout(() => { progressWrap.style.display = "none"; }, 2000);
    // ❌ دیگر downloadUpdatedData() اینجا نیست — همه چیز در Firebase است
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
  const btnUploads  = document.getElementById("btnTabUploads");
  const btnSettings = document.getElementById("btnTabSettings");

  if (tabName === "uploads") {
    uploadsContent.style.display  = "block";
    settingsContent.style.display = "none";
    btnUploads.classList.add("active");
    btnUploads.style.borderBottomColor  = "var(--gold)";
    btnUploads.style.color              = "var(--brown-dark)";
    btnUploads.style.fontWeight         = "600";
    btnSettings.classList.remove("active");
    btnSettings.style.borderBottomColor = "transparent";
    btnSettings.style.color             = "var(--text-muted)";
    btnSettings.style.fontWeight        = "500";
  } else {
    uploadsContent.style.display  = "none";
    settingsContent.style.display = "block";
    btnSettings.classList.add("active");
    btnSettings.style.borderBottomColor = "var(--gold)";
    btnSettings.style.color             = "var(--brown-dark)";
    btnSettings.style.fontWeight        = "600";
    btnUploads.classList.remove("active");
    btnUploads.style.borderBottomColor  = "transparent";
    btnUploads.style.color              = "var(--text-muted)";
    btnUploads.style.fontWeight         = "500";
  }
}
