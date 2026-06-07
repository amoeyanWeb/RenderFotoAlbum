/* ════════════════════════════════════════════════════════════
   app.js — Firebase Version
   All data (photos, events, occasions) stored in Firebase RTDB
   No need for data.js — every change is saved directly to the database
   ════════════════════════════════════════════════════════════ */
// After uploading the project to Render, replace this URL with your Render site URL

(function () {
  // ══════════════════════════════════════════════════════════
  //  ⚙️  Firebase and Cloudinary Configuration
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
  //  No changes needed below this line
  // ══════════════════════════════════════════════════════════

  // ── Firebase init ──
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();

  // ── Local Memory (Cache) ──
  // DATA: { [occasion]: [ { label, photos: [{src, title}] } ] }  — array format
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

  // Convert Firebase structure (object with keys e0,e1,...) to array
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

  // Generate a unique key for Firebase
  function fbKey() {
    return (
      "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    );
  }

  // Load all data from Firebase
  // Updated for higher security
  async function loadAllData() {
    const [labelsSnap, albumsSnap] = await Promise.all([
      rtdb.ref("/labels").once("value"),
      rtdb.ref("/albums").once("value"),
      // ❌ The line for fetching passwords has been completely removed
    ]);

    window.LABELS = labelsSnap.val() || {};
    window.DATA = {};

    Object.keys(albumsSnap.val() || {}).forEach(function (occ) {
      window.DATA[occ] = fbEventsToArray(albumsSnap.val()[occ]);
    });

    // Config: only Cloudinary name remains public
    _cfg.cloudName = "delf4luxo";
    _cfg.preset = "ml_default";

    return true;
  }

  // Save credentials to Firebase
  async function saveCredentialsToFirebase(updates) {
    try {
      await rtdb.ref("/").update(updates);
      return true;
    } catch (err) {
      console.error("Firebase RTDB write error:", err);
      return false;
    }
  }

  // Save an event to Firebase (create or update)
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

  // Delete an event from Firebase
  async function deleteEventFromFB(occ, fbKey) {
    await rtdb.ref("/albums/" + occ + "/" + fbKey).remove();
  }

  // Delete a photo from Firebase
  async function deletePhotoFromFB(occ, eventFbKey, photoFbKey) {
    await rtdb
      .ref("/albums/" + occ + "/" + eventFbKey + "/photos/" + photoFbKey)
      .remove();
  }

  // Add a photo to Firebase
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

  // Update event order after splice
  async function reorderEventsFB(occ) {
    const updates = {};
    (window.DATA[occ] || []).forEach(function (ev, idx) {
      if (ev._fbKey)
        updates["/albums/" + occ + "/" + ev._fbKey + "/order"] = idx;
    });
    if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
  }

  // ══════════════════════════════════════════════════════════
  //  Initial Load
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
      // After loading, show the login window
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
      errEl.textContent = "Please fill in all fields";
      return;
    }

    errEl.textContent = "⏳ Verifying login credentials...";

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
            "— Select Occasion —",
          );
        }
      } else {
        errEl.textContent = result.error || "Incorrect username or password";
      }
    } catch (err) {
      errEl.textContent = "❌ Failed to connect to the cloud server";
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

    // System login is now handled by index.html — no modal needed here
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.display = "none";
  });

  // ══════════════════════════════════════════════════════════
  //  Admin Panel Open/Close
  // ══════════════════════════════════════════════════════════
  //  Language Switch — session preserved, only page changes
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

    // Show overlay
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
      if (errEl) errEl.textContent = "Please fill in all fields";
      return;
    }

    if (errEl) errEl.textContent = "⏳ Verifying admin credentials...";

    try {
      // Send request to server (Render / localhost)
      const response = await fetch(`${FUNCTIONS_BASE_URL}/secureLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p, type: "admin" }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Admin login successful
        document.getElementById("loginCard").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";

        // Save login state to sessionStorage for temporary persistence
        sessionStorage.setItem("adminLoggedIn", "true");

        // Run admin panel helper functions previously in code
        if (typeof initAdminPanel === "function") initAdminPanel();
      } else {
        if (errEl)
          errEl.textContent =
            result.error || "Incorrect admin username or password";
      }
    } catch (err) {
      if (errEl) errEl.textContent = "❌ Failed to connect to the cloud server";
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

    if (!cloudName) return showCfgStatus("⚠️ Please enter Cloud Name", "red");
    if (!preset) return showCfgStatus("⚠️ Please enter Upload Preset", "red");

    setCfg("cloudName", cloudName);
    setCfg("preset", preset);
    if (apiKey) setCfg("apiKey", apiKey);
    if (apiSecret) setCfg("apiSecret", apiSecret);

    showCfgStatus("✅ Settings saved (until browser is closed)", "green");
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
        ? "🔐 Change System Login Password"
        : "🔑 Change Admin Panel Password";
    document.getElementById("pwdModalDesc").textContent =
      type === "system"
        ? "Enter current and new information"
        : "Enter admin login information";
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
      applyBtn.textContent = "Change";
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
      errEl.textContent = "⚠️ Please enter a new username";
      return;
    }

    const uKey = pwdTargetType === "system" ? "sysUser" : "adminUser";
    const pKey = pwdTargetType === "system" ? "sysPass" : "adminPass";

    if (currentPass !== cfg(pKey)) {
      errEl.textContent = "⚠️ Current password is incorrect";
      return;
    }
    if (newPass.length < 6) {
      errEl.textContent = "⚠️ New password must be at least 6 characters";
      return;
    }
    if (newPass !== confirmPass) {
      errEl.textContent = "⚠️ New password and confirmation do not match";
      return;
    }

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = "⏳ Saving...";
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
      apToast("✅ Login details successfully saved to Firebase");
    } else {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = "Change";
      }
      errEl.textContent = "❌ Save error — please try again";
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
          id === "selOccasion" ? "— Select Occasion —" : "Select occasion...";
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

    manageEventSel.innerHTML = '<option value="">Select event...</option>';
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
    if (!persianName) return apToast("⚠️ Please enter an occasion name");
    // Unique key: occ_ + short timestamp
    const englishKey = "occ_" + Date.now().toString(36);

    try {
      apToast("⏳ Saving to Firebase...");
      // Save to Firebase
      await rtdb.ref("/labels/" + englishKey).set(persianName);
      // Create albums/englishKey with a placeholder so the key exists
      // (Firebase doesn't store empty objects — without an event, the key won't exist)

      window.DATA[englishKey] = [];
      window.LABELS[englishKey] = persianName;

      refreshAllSelectors();
      document.getElementById("newOccasionName").value = "";
      document.getElementById("newOccasionRef").value = "";
      apToast(`✅ Occasion "${persianName}" created and saved to Firebase`);
    } catch (err) {
      console.error(err);
      apToast("❌ Save error");
    }
  };

  window.deleteOccasion = async function () {
    const key = document.getElementById("deleteOccasionSelector").value;
    if (!key) return apToast("⚠️ Please select an occasion to delete first");

    const events = window.DATA[key] || [];
    if (events.length > 0) {
      return apToast(`⛔ Occasion "${window.LABELS[key] || key}" has ${events.length} events — delete all events first`);
    }

    const label = window.LABELS[key] || key;
    if (!confirm(`Are you sure you want to delete the occasion "${label}"?`)) return;

    try {
      apToast("⏳ Deleting from Firebase...");
      await rtdb.ref("/labels/" + key).remove();
      await rtdb.ref("/albums/" + key).remove();
      delete window.DATA[key];
      delete window.LABELS[key];
      refreshAllSelectors();
      // reset selector
      const sel = document.getElementById("deleteOccasionSelector");
      if (sel) { sel.innerHTML = '<option value="">Select occasion to delete...</option>'; fillDeleteOccasionSelector(); }
      apToast(`✅ Occasion "${label}" deleted`);
    } catch (err) {
      console.error(err);
      apToast("❌ Delete error");
    }
  };

  function fillDeleteOccasionSelector() {
    const sel = document.getElementById("deleteOccasionSelector");
    if (!sel) return;
    sel.innerHTML = '<option value="">Select occasion to delete...</option>';
    Object.keys(window.DATA || {}).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = (window.LABELS[key] || key) + (window.DATA[key].length > 0 ? ` (${window.DATA[key].length} events)` : " (empty)");
      sel.appendChild(opt);
    });
  }
  window.fillDeleteOccasionSelector = fillDeleteOccasionSelector;

  window.createNewEvent = async function () {
    const occ = document.getElementById("eventOccasionSelector").value;
    const label = document.getElementById("newEventName").value.trim();
    if (!occ) return apToast("Please select an occasion");
    if (!label) return apToast("Please enter an event name");
    if (!window.DATA[occ]) window.DATA[occ] = [];

    try {
      apToast("⏳ Saving to Firebase...");
      const key = fbKey();
      const order = window.DATA[occ].length;
      await rtdb.ref("/albums/" + occ + "/" + key).set({
        label: label,
        order: order,
        photos: {},
      });
      window.DATA[occ].push({ _fbKey: key, label: label, photos: [] });
      apToast(`✅ Event "${label}" added and saved to Firebase`);
      document.getElementById("newEventName").value = "";
      refreshAllSelectors();
    } catch (err) {
      console.error(err);
      apToast("❌ Save error");
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Fetch Event Photos (for Admin Panel)
  // ══════════════════════════════════════════════════════════

  window.fetchEventPhotos = function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("⚠️ Please select an occasion first");
    if (eventIdx === "") return apToast("⚠️ Please select an event first");

    const event = window.DATA[occ][eventIdx];
    if (!event) return apToast("Event not found");
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
          '<p style="color:#a07850;font-size:0.85rem;padding:8px">This event has no photos yet</p>';
      apToast(`Event "${event.label}" — no photos`);
      return;
    }

    renderAdminPhotoGrid();
    apToast(`✅ Event "${event.label}" — ${apQueue.length} photos`);
  };

  window.updateExistingPhotoTitle = function (
    occ,
    eventIdx,
    photoIdx,
    newTitle,
  ) {
    if (window.DATA[occ]?.[eventIdx]?.photos?.[photoIdx] !== undefined) {
      window.DATA[occ][eventIdx].photos[photoIdx].title = newTitle;
      // Update in Firebase
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
    if (!confirm("Delete this photo from the event and Cloudinary?")) return;
    if (!window.DATA[occ]?.[eventIdx]) return;

    const ev = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) return;

    // Delete from Cloudinary
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok") apToast("🗑 Photo deleted from Cloudinary and album");
    else if (r === "skip")
      apToast("🗑 Photo deleted from album (API Key/Secret not configured)");
    else apToast("🗑 Photo deleted from album (Cloudinary error)");

    // Delete from Firebase
    if (ev._fbKey && photo._fbKey) {
      await deletePhotoFromFB(occ, ev._fbKey, photo._fbKey);
    }

    // Delete from local memory
    ev.photos.splice(photoIdx, 1);

    // Update order of remaining photos in Firebase
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
  //  Delete Photo from Lightbox — Cloudinary + Firebase + Memory
  // ══════════════════════════════════════════════════════════

  window.lbDeletePhoto = async function () {
    const occ      = window._lbOcc;
    const eventIdx = window._lbEventIdx;
    const photoIdx = window._lbPhotoIdx;

    if (occ === undefined || eventIdx === undefined || photoIdx === undefined) {
      apToast("⚠️ Photo info not found"); return;
    }
    if (!window.DATA[occ]?.[eventIdx]) {
      apToast("⚠️ Event not found"); return;
    }

    const ev    = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) { apToast("⚠️ Photo not found"); return; }

    if (!confirm("Delete this photo from the album, Firebase and Cloudinary?")) return;

    const lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("open");

    // 1) Delete from Cloudinary
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok")        apToast("🗑 Photo deleted from Cloudinary and album");
    else if (r === "skip") apToast("🗑 Photo deleted (API Key/Secret not set)");
    else                   apToast("🗑 Photo deleted (Cloudinary error)");

    // 2) Delete from Firebase
    if (ev._fbKey && photo._fbKey) {
      await deletePhotoFromFB(occ, ev._fbKey, photo._fbKey);
    }

    // 3) Delete from local memory
    ev.photos.splice(photoIdx, 1);

    // 4) Update order of remaining photos in Firebase
    if (ev._fbKey && ev.photos.length > 0) {
      const updates = {};
      ev.photos.forEach(function (p, idx) {
        if (p._fbKey)
          updates["/albums/" + occ + "/" + ev._fbKey + "/photos/" + p._fbKey + "/order"] = idx;
      });
      if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
    }

    // 5) Refresh gallery
    if (typeof window._lbRefreshGallery === "function") {
      window._lbRefreshGallery();
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Delete Entire Event
  // ══════════════════════════════════════════════════════════

  window.deleteEntireEvent = async function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("Please select an occasion");
    if (eventIdx === "") return apToast("Please select an event");

    const event = window.DATA[occ][eventIdx];
    const label = event.label;
    const photos = event.photos || [];

    if (
      !confirm(
        `Delete event "${label}" and all ${photos.length} photos from the site and Cloudinary?`,
      )
    )
      return;

    if (photos.length > 0) {
      apToast(`⏳ Deleting ${photos.length} photos from Cloudinary...`);
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
          `🗑 Event "${label}" deleted (API Key/Secret not configured — Cloudinary unchanged)`,
        );
      else if (failed > 0)
        apToast(`⚠️ ${ok} photos deleted from Cloudinary — ${failed} with errors`);
      else apToast(`✅ ${ok} photos deleted from Cloudinary and event "${label}"`);
    } else {
      apToast(`🗑 Event "${label}" deleted`);
    }

    // Delete from Firebase
    if (event._fbKey) await deleteEventFromFB(occ, event._fbKey);

    // Delete from local memory
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
    if (!imgs.length) return apToast("Please select an image file");

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
      "⏳ Reading 1 of " + total + "...";

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
            "⏳ Reading " + (loaded + 1) + " of " + total + "...";
        } else {
          progressLabel.textContent =
            "✅ " + total + " photos ready to upload to Cloudinary";
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
          "⚠️ Read error: " + file.name;
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
        return `<div class="apg-item" id="apgitem-${p.id}">${s}<img src="${p.preview}" alt=""><input class="apg-title" type="text" value="${p.title.replace(/"/g, "&quot;")}" placeholder="Photo title" onchange="updatePhotoTitle('${p.id}',this.value)"><button class="apg-del" onclick="removeFromQueue('${p.id}')" title="Delete">🗑</button></div>`;
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
  //  Upload to Cloudinary — and save directly to Firebase
  // ══════════════════════════════════════════════════════════

  // ── Upload stop control variable ──
  let _uploadCancelled = false;

  window.cancelUpload = function () {
    _uploadCancelled = true;
    apToast("⛔ Stopping upload...");
    const stopBtn = document.getElementById("stopUploadBtn");
    if (stopBtn) stopBtn.disabled = true;
  };

  window.uploadToCloudinary = async function () {
    const occ = document.getElementById("manageOccasionSelector")?.value || "";
    const eventIdx =
      document.getElementById("manageEventSelector")?.value ?? "";

    if (!occ) return apToast("⚠️ Please select an occasion first");
    if (eventIdx === "") return apToast("⚠️ Please select an event first");

    const toProcess = apQueue.filter(
      (p) => p.status === "pending" || p.status === "existing",
    );
    if (!toProcess.length) return apToast("No photos in the queue");

    const existingPhotos = toProcess.filter((p) => p.status === "existing");
    const pendingPhotos = toProcess.filter((p) => p.status === "pending");

    if (existingPhotos.length > 0) {
      const srcOcc = existingPhotos[0].srcOcc;
      const srcEventIdx = existingPhotos[0].srcEventIdx;
      if (srcOcc === occ && String(srcEventIdx) === String(eventIdx)) {
        return apToast(
          "⚠️ Source and destination are the same — change the target occasion/event",
        );
      }
    }

    // 🔒 New upload conditions updated: no client-side check needed, but we keep the Cloudinary name
    if (pendingPhotos.length > 0) {
      if (!_cfg.cloudName) return apToast("Cloud Name is not configured");
    }

    const progressWrap = document.getElementById("uploadProgressWrap");
    const progressBar = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl = document.getElementById("statusMessage");
    const stopBtn = document.getElementById("stopUploadBtn");

    // Activate stop button
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

    // ── Single photo upload function (with dedicated signature) ──
    async function uploadSinglePhoto(photo, idx) {
      if (_uploadCancelled) return "cancelled";

      photo.status = "uploading";
      renderAdminPhotoGrid();
      progressLabel.textContent = `Uploading ${idx + 1} of ${total}: ${photo.title || "Untitled"}`;

      try {
        // Get a separate signature for each photo
        // Send context to server to be included in signature
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
          throw new Error(`Server responded with ${sigResponse.status}: ${errText}`);
        }

        const sigData = await sigResponse.json();
        if (!sigData.success) {
          throw new Error(sigData.error || "Failed to get signature from server");
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
        console.error(`❌ Upload failed for ${photo.title}:`, err.message);
        photo.status = "error";
        return "error";
      }
    }

    // ── Transfer existing photos (sequential because of Firebase writes) ──
    for (const photo of toProcess.filter(p => p.status === "existing")) {
      if (_uploadCancelled) break;
      progressLabel.textContent = `Transferring: ${photo.title}`;
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

    // ── Parallel upload of new photos (3 concurrent) ──
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
        apToast(`⛔ Upload stopped. Successful: ${successCount} | Errors: ${errorCount}`);
        if (stopBtn) stopBtn.style.display = "none";
        return;
      }
      const batch = pendingQueue.slice(i, i + CONCURRENCY);
      await runBatch(batch, i);
    }

    // Hide stop button after completion
    if (stopBtn) stopBtn.style.display = "none";
    apToast(`✅ Operation complete. Successful: ${successCount} | Errors: ${errorCount}`);
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
