/* ════════════════════════════════════════════════════════════
   appTR.js — Firebase Sürümü (v2)
   - System login bu dosyada YOK — index.html gateway'i üstlendi
   - Sayfa açılışında sessionStorage kontrol edilir; giriş yoksa index.html'e yönlendirilir
   - Admin login ve admin panel BU DOSYADA KALIR
   ════════════════════════════════════════════════════════════ */

(function () {
  // ══════════════════════════════════════════════════════════
  //  🔒 Oturum Kontrolü — System login yapılmamışsa geri gönder
  // ══════════════════════════════════════════════════════════
  if (sessionStorage.getItem("initialLoggedIn") !== "true") {
    window.location.href = "index.html";
    // Sayfanın geri kalanının çalışmasını durdur
    throw new Error("AUTH_REDIRECT");
  }

  // ══════════════════════════════════════════════════════════
  //  ⚙️  Firebase ve Cloudinary Ayarları
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
  };

  // ══════════════════════════════════════════════════════════
  //  Bu satırın altını değiştirmenize gerek yok
  // ══════════════════════════════════════════════════════════

  // ── Firebase init ──
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();

  // ── Yerel Bellek (Önbellek) ──
  window.DATA = {};
  window.LABELS = {};

  let _cfg = {
    cloudName: CONFIG.cloudName,
    preset: CONFIG.uploadPreset,
    apiKey: CONFIG.apiKey,
    apiSecret: CONFIG.apiSecret,
    adminUser: "",
    adminPass: "",
  };

  function cfg(k) { return _cfg[k] || ""; }
  function setCfg(k, v) { _cfg[k] = v; }

  let apQueue = [];
  let pwdTargetType = "";

  // ══════════════════════════════════════════════════════════
  //  Firebase Helper Functions
  // ══════════════════════════════════════════════════════════

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

  function fbKey() {
    return (
      "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    );
  }

  async function loadAllData() {
    const [labelsSnap, albumsSnap] = await Promise.all([
      rtdb.ref("/labels").once("value"),
      rtdb.ref("/albums").once("value"),
    ]);

    window.LABELS = labelsSnap.val() || {};
    window.DATA = {};

    Object.keys(albumsSnap.val() || {}).forEach(function (occ) {
      window.DATA[occ] = fbEventsToArray(albumsSnap.val()[occ]);
    });

    _cfg.cloudName = "delf4luxo";
    _cfg.preset = "ml_default";

    return true;
  }

  async function saveCredentialsToFirebase(updates) {
    try {
      await rtdb.ref("/").update(updates);
      return true;
    } catch (err) {
      console.error("Firebase RTDB write error:", err);
      return false;
    }
  }

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

  async function deleteEventFromFB(occ, fbKey) {
    await rtdb.ref("/albums/" + occ + "/" + fbKey).remove();
  }

  async function deletePhotoFromFB(occ, eventFbKey, photoFbKey) {
    await rtdb
      .ref("/albums/" + occ + "/" + eventFbKey + "/photos/" + photoFbKey)
      .remove();
  }

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

  async function reorderEventsFB(occ) {
    const updates = {};
    (window.DATA[occ] || []).forEach(function (ev, idx) {
      if (ev._fbKey)
        updates["/albums/" + occ + "/" + ev._fbKey + "/order"] = idx;
    });
    if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
  }

  // ══════════════════════════════════════════════════════════
  //  İlk Yükleme
  // ══════════════════════════════════════════════════════════

  let _dataLoaded = false;
  let _dataCallbacks = [];

  function onDataReady(cb) {
    if (_dataLoaded) { cb(); return; }
    _dataCallbacks.push(cb);
  }

  loadAllData()
    .then(function () {
      _dataLoaded = true;
      window._dataLoaded = true;
      _dataCallbacks.forEach(function (cb) { cb(); });
      _dataCallbacks = [];
      // ✅ System login modal YOK — veri yüklenince direkt içerik hazır
    })
    .catch(function (err) {
      console.error("Firebase load error:", err);
      _dataLoaded = true;
      window._dataLoaded = true;
      _dataCallbacks.forEach(function (cb) { cb(); });
      _dataCallbacks = [];
    });

  // ══════════════════════════════════════════════════════════
  //  DOMContentLoaded — Başlangıç Ayarları
  // ══════════════════════════════════════════════════════════

  document.addEventListener("DOMContentLoaded", function () {
    // Admin panel ve login card başlangıçta gizli
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

    // ──  System login modal varsa KALICI gizle (indexTR.html'de artık olmamalı)
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) systemModal.style.display = "none";
  });

  // ══════════════════════════════════════════════════════════
  //  Dil Değiştirme — Oturumu koru, sadece sayfayı değiştir
  // ══════════════════════════════════════════════════════════

  window.switchLang = function (lang) {
    // Oturumu koru
    sessionStorage.setItem("initialLoggedIn", "true");
    sessionStorage.setItem("albumLang", lang);
    const map = { TR: "indexTR.html", FA: "indexFA.html", EN: "indexEN.html" };
    window.location.href = map[lang] || "indexTR.html";
  };

  // ══════════════════════════════════════════════════════════
  //  Admin Panel Open/Close
  // ══════════════════════════════════════════════════════════

  window.openAdmin = function () {
    document.getElementById("adUser").value = "";
    document.getElementById("adPass").value = "";
    document.getElementById("adErr").textContent = "";

    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

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
      if (errEl) errEl.textContent = "Lütfen tüm alanları doldurun";
      return;
    }
    if (errEl) errEl.textContent = "⏳ Admin giriş bilgileri kontrol ediliyor...";

    try {
      const response = await fetch(`${FUNCTIONS_BASE_URL}/secureLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p, type: "admin" }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        document.getElementById("loginCard").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        sessionStorage.setItem("adminLoggedIn", "true");
        if (typeof initAdminPanel === "function") initAdminPanel();
      } else {
        if (errEl)
          errEl.textContent =
            result.error || "Admin kullanıcı adı veya şifresi hatalı";
      }
    } catch (err) {
      if (errEl) errEl.textContent = "❌ Bulut sunucusuna bağlanılamadı";
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
  //  Password Modal
  // ══════════════════════════════════════════════════════════

  window.openPwdModal = function (type) {
    pwdTargetType = type;
    document.getElementById("pwdModalTitle").textContent =
      type === "system"
        ? "🔐 Sistem Giriş Şifresini Değiştir"
        : "🔑 Admin Paneli Şifresini Değiştir";
    document.getElementById("pwdModalDesc").textContent =
      type === "system"
        ? "Mevcut ve yeni bilgileri girin"
        : "Admin giriş bilgilerini girin";
    ["pwdNewUser", "pwdCurrentPass", "pwdNewPass", "pwdConfirmPass"].forEach(
      function (id) { document.getElementById(id).value = ""; }
    );
    document.getElementById("pwdErr").textContent = "";
    document.getElementById("pwdChangeOverlay").classList.add("open");
  };

  window.closePwdModal = function () {
    var errEl = document.getElementById("pwdErr");
    if (errEl) { errEl.textContent = ""; errEl.style.color = ""; }
    ["pwdNewUser", "pwdCurrentPass", "pwdNewPass", "pwdConfirmPass"].forEach(
      function (id) { var el = document.getElementById(id); if (el) el.value = ""; }
    );
    var applyBtn = document.getElementById("pwdApplyBtn");
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = "Değiştir"; }
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

    if (!newUser) { errEl.textContent = "⚠️ Yeni kullanıcı adını giriniz"; return; }

    const pKey = pwdTargetType === "system" ? "sysPass" : "adminPass";
    if (currentPass !== cfg(pKey)) { errEl.textContent = "⚠️ Mevcut şifre hatalı"; return; }
    if (newPass.length < 6) { errEl.textContent = "⚠️ Yeni şifre en az 6 karakter olmalıdır"; return; }
    if (newPass !== confirmPass) { errEl.textContent = "⚠️ Yeni şifre ve tekrarı uyuşmuyor"; return; }

    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = "⏳ Kaydediliyor..."; }

    const fbUpdates =
      pwdTargetType === "system"
        ? { systemUsername: newUser, systemPassword: newPass }
        : { adminUsername: newUser, adminPassword: newPass };

    const ok = await saveCredentialsToFirebase(fbUpdates);
    if (ok) {
      const uKey = pwdTargetType === "system" ? "sysUser" : "adminUser";
      setCfg(uKey, newUser);
      setCfg(pKey, newPass);
      closePwdModal();
      apToast("✅ Giriş bilgileri başarıyla Firebase'e kaydedildi");
    } else {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = "Değiştir"; }
      errEl.textContent = "❌ Kaydetme hatası — lütfen tekrar deneyin";
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
          id === "selOccasion" ? "— Etkinlik Seçin —" : "Etkinlik seçin...";
        fillOccasionSel(sel, placeholder);
      }
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
    manageEventSel.innerHTML = '<option value="">Olay seçin...</option>';
    if (!occ || !window.DATA[occ]) return;
    window.DATA[occ].forEach(function (group, i) {
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
    if (!persianName) return apToast("⚠️ Etkinlik adını giriniz");
    const englishKey = "occ_" + Date.now().toString(36);
    try {
      apToast("⏳ Firebase'e kaydediliyor...");
      await rtdb.ref("/labels/" + englishKey).set(persianName);
      window.DATA[englishKey] = [];
      window.LABELS[englishKey] = persianName;
      refreshAllSelectors();
      document.getElementById("newOccasionName").value = "";
      apToast(`✅ "${persianName}" etkinliği oluşturuldu`);
    } catch (err) {
      console.error(err);
      apToast("❌ Kaydetme hatası");
    }
  };

  window.deleteOccasion = async function () {
    const key = document.getElementById("deleteOccasionSelector").value;
    if (!key) return apToast("⚠️ Önce silinecek bir etkinlik seçin");
    const events = window.DATA[key] || [];
    if (events.length > 0) {
      return apToast(`⛔ "${window.LABELS[key] || key}" etkinliğinde ${events.length} olay var — önce tüm olayları silin`);
    }
    const label = window.LABELS[key] || key;
    if (!confirm(`"${label}" etkinliğini silmek istediğinizden emin misiniz?`)) return;
    try {
      apToast("⏳ Firebase'den siliniyor...");
      await rtdb.ref("/labels/" + key).remove();
      await rtdb.ref("/albums/" + key).remove();
      delete window.DATA[key];
      delete window.LABELS[key];
      refreshAllSelectors();
      const sel = document.getElementById("deleteOccasionSelector");
      if (sel) { sel.innerHTML = '<option value="">Silinecek etkinliği seçin...</option>'; fillDeleteOccasionSelector(); }
      apToast(`✅ "${label}" etkinliği silindi`);
    } catch (err) {
      console.error(err);
      apToast("❌ Silme hatası");
    }
  };

  function fillDeleteOccasionSelector() {
    const sel = document.getElementById("deleteOccasionSelector");
    if (!sel) return;
    sel.innerHTML = '<option value="">Silinecek etkinliği seçin...</option>';
    Object.keys(window.DATA || {}).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = (window.LABELS[key] || key) +
        (window.DATA[key].length > 0 ? ` (${window.DATA[key].length} olay)` : " (boş)");
      sel.appendChild(opt);
    });
  }
  window.fillDeleteOccasionSelector = fillDeleteOccasionSelector;

  window.createNewEvent = async function () {
    const occ = document.getElementById("eventOccasionSelector").value;
    const label = document.getElementById("newEventName").value.trim();
    if (!occ) return apToast("Etkinlik seçin");
    if (!label) return apToast("Olay adını giriniz");
    if (!window.DATA[occ]) window.DATA[occ] = [];
    try {
      apToast("⏳ Firebase'e kaydediliyor...");
      const key = fbKey();
      const order = window.DATA[occ].length;
      await rtdb.ref("/albums/" + occ + "/" + key).set({ label, order, photos: {} });
      window.DATA[occ].push({ _fbKey: key, label, photos: [] });
      apToast(`✅ "${label}" olayı eklendi`);
      document.getElementById("newEventName").value = "";
      refreshAllSelectors();
    } catch (err) {
      console.error(err);
      apToast("❌ Kaydetme hatası");
    }
  };

  // ══════════════════════════════════════════════════════════
  //  Fetch Event Photos
  // ══════════════════════════════════════════════════════════

  window.fetchEventPhotos = function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("⚠️ Önce etkinliği seçin");
    if (eventIdx === "") return apToast("⚠️ Önce olayı seçin");
    const event = window.DATA[occ][eventIdx];
    if (!event) return apToast("Olay bulunamadı");
    const photos = event.photos || [];
    apQueue = photos.map(function (p, idx) {
      return {
        id: "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        src: p.src, preview: p.src, title: p.title || "",
        status: "existing", srcOcc: occ, srcEventIdx: parseInt(eventIdx),
        photoIdx: idx, _fbPhotoKey: p._fbKey,
      };
    });
    if (apQueue.length === 0) {
      const grid = document.getElementById("adminPhotoGrid");
      if (grid) grid.innerHTML = '<p style="color:#a07850;font-size:0.85rem;padding:8px">Bu olayda henüz fotoğraf yok</p>';
      apToast(`"${event.label}" olayı — fotoğraf yok`);
      return;
    }
    renderAdminPhotoGrid();
    apToast(`✅ "${event.label}" olayı — ${apQueue.length} fotoğraf`);
  };

  window.updateExistingPhotoTitle = function (occ, eventIdx, photoIdx, newTitle) {
    if (window.DATA[occ]?.[eventIdx]?.photos?.[photoIdx] !== undefined) {
      window.DATA[occ][eventIdx].photos[photoIdx].title = newTitle;
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
    const apiKey = cfg("apiKey");
    const apiSecret = cfg("apiSecret");
    if (!cloudName || !apiKey || !apiSecret) return "skip";
    const match = srcUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    const publicId = match ? match[1] : null;
    if (!publicId) return "error";
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(strToSign));
      const signature = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const fd = new FormData();
      fd.append("public_id", publicId);
      fd.append("timestamp", timestamp);
      fd.append("api_key", apiKey);
      fd.append("signature", signature);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: fd });
      const result = await res.json();
      return result.result === "ok" ? "ok" : "error";
    } catch (err) {
      console.error("Cloudinary delete error:", err);
      return "error";
    }
  }

  window.deleteExistingPhoto = async function (occ, eventIdx, photoIdx) {
    if (!confirm("Bu fotoğraf olaydan ve Cloudinary'den silinsin mi?")) return;
    if (!window.DATA[occ]?.[eventIdx]) return;
    const ev = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) return;
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok") apToast("🗑 Fotoğraf Cloudinary'den ve albümden silindi");
    else if (r === "skip") apToast("🗑 Fotoğraf albümden silindi (API Key/Secret ayarlanmamış)");
    else apToast("🗑 Fotoğraf albümden silindi (Cloudinary hatası)");
    if (ev._fbKey && photo._fbKey) await deletePhotoFromFB(occ, ev._fbKey, photo._fbKey);
    ev.photos.splice(photoIdx, 1);
    if (ev._fbKey) {
      const updates = {};
      ev.photos.forEach(function (p, idx) {
        if (p._fbKey) updates["/albums/" + occ + "/" + ev._fbKey + "/photos/" + p._fbKey + "/order"] = idx;
      });
      if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
    }
    window.fetchEventPhotos();
  };

  // ══════════════════════════════════════════════════════════
  //  Lightbox'tan Fotoğraf Silme — Cloudinary + Firebase + Bellek
  // ══════════════════════════════════════════════════════════

  window.lbDeletePhoto = async function () {
    const occ      = window._lbOcc;
    const eventIdx = window._lbEventIdx;
    const photoIdx = window._lbPhotoIdx;

    if (occ === undefined || eventIdx === undefined || photoIdx === undefined) {
      apToast("⚠️ Fotoğraf bilgisi bulunamadı"); return;
    }
    if (!window.DATA[occ]?.[eventIdx]) {
      apToast("⚠️ Olay bulunamadı"); return;
    }

    const ev    = window.DATA[occ][eventIdx];
    const photo = ev.photos[photoIdx];
    if (!photo) { apToast("⚠️ Fotoğraf bulunamadı"); return; }

    if (!confirm("Bu fotoğraf albümden, Firebase'den ve Cloudinary'den silinsin mi?")) return;

    const lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("open");

    // 1) Cloudinary'den sil
    const r = await cloudinaryDelete(photo.src);
    if (r === "ok")        apToast("🗑 Fotoğraf Cloudinary ve albümden silindi");
    else if (r === "skip") apToast("🗑 Fotoğraf silindi (API Key/Secret ayarlanmamış)");
    else                   apToast("🗑 Fotoğraf silindi (Cloudinary hatası)");

    // 2) Firebase'den sil
    if (ev._fbKey && photo._fbKey) {
      await deletePhotoFromFB(occ, ev._fbKey, photo._fbKey);
    }

    // 3) Yerel bellekten sil
    ev.photos.splice(photoIdx, 1);

    // 4) Kalan fotoğrafların sırasını Firebase'de güncelle
    if (ev._fbKey && ev.photos.length > 0) {
      const updates = {};
      ev.photos.forEach(function (p, idx) {
        if (p._fbKey)
          updates["/albums/" + occ + "/" + ev._fbKey + "/photos/" + p._fbKey + "/order"] = idx;
      });
      if (Object.keys(updates).length > 0) await rtdb.ref("/").update(updates);
    }

    // 5) Galeriyi yenile
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
    if (!occ) return apToast("Etkinlik seçin");
    if (eventIdx === "") return apToast("Olay seçin");
    const event = window.DATA[occ][eventIdx];
    const label = event.label;
    const photos = event.photos || [];
    if (!confirm(`"${label}" olayı ve ${photos.length} fotoğrafın tamamı siteden ve Cloudinary'den silinsin mi?`)) return;
    if (photos.length > 0) {
      apToast(`⏳ ${photos.length} fotoğraf Cloudinary'den siliniyor...`);
      let ok = 0, skipped = 0, failed = 0;
      for (const photo of photos) {
        const r = await cloudinaryDelete(photo.src);
        if (r === "ok") ok++;
        else if (r === "skip") skipped++;
        else failed++;
      }
      if (skipped === photos.length) apToast(`🗑 "${label}" olayı silindi (Cloudinary değişmedi)`);
      else if (failed > 0) apToast(`⚠️ ${ok} fotoğraf Cloudinary'den silindi — ${failed} hatalı`);
      else apToast(`✅ ${ok} fotoğraf Cloudinary'den ve "${label}" olayından silindi`);
    } else {
      apToast(`🗑 "${label}" olayı silindi`);
    }
    if (event._fbKey) await deleteEventFromFB(occ, event._fbKey);
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
    const imgs = [...e.target.files].filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return apToast("Bir görüntü dosyası seçin");
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
    progressLabel.textContent = "⏳ Okunuyor 1 / " + total + "...";
    imgs.forEach(function (file) {
      const id = "q" + Date.now() + Math.random().toString(36).slice(2, 6);
      const reader = new FileReader();
      reader.onprogress = function (ev) {
        if (ev.lengthComputable) {
          const overallPct = Math.round(((loaded + ev.loaded / ev.total) / total) * 100);
          progressBar.style.width = overallPct + "%";
        }
      };
      reader.onload = function (ev) {
        loaded++;
        apQueue.push({ id, file, preview: ev.target.result, title: file.name.replace(/\.[^.]+$/, ""), status: "pending" });
        progressBar.style.width = Math.round((loaded / total) * 100) + "%";
        if (loaded < total) {
          progressLabel.textContent = "⏳ Okunuyor " + (loaded + 1) + " / " + total + "...";
        } else {
          progressLabel.textContent = "✅ " + total + " fotoğraf Cloudinary'e yüklemeye hazır";
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
        progressLabel.textContent = "⚠️ Okuma hatası: " + file.name;
        if (loaded === total) setTimeout(function () { progressWrap.style.display = "none"; }, 2000);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  function renderAdminPhotoGrid() {
    const grid = document.getElementById("adminPhotoGrid");
    if (!grid) return;
    if (!apQueue.length) { grid.innerHTML = ""; return; }
    grid.innerHTML = apQueue.map(function (p) {
      const s =
        p.status === "existing" ? '<div class="apg-badge apg-done">✓</div>' :
        p.status === "done"     ? '<div class="apg-badge apg-done">✓</div>' :
        p.status === "uploading"? '<div class="apg-badge apg-uploading">↑</div>' :
        p.status === "error"    ? '<div class="apg-badge apg-error">✗</div>' : "";
      return `<div class="apg-item" id="apgitem-${p.id}">${s}<img src="${p.preview}" alt=""><input class="apg-title" type="text" value="${p.title.replace(/"/g, "&quot;")}" placeholder="Fotoğraf başlığı" onchange="updatePhotoTitle('${p.id}',this.value)"><button class="apg-del" onclick="removeFromQueue('${p.id}')" title="Sil">🗑</button></div>`;
    }).join("");
  }

  window.updatePhotoTitle = (id, title) => {
    const p = apQueue.find(x => x.id === id);
    if (p) p.title = title;
  };
  window.removeFromQueue = (id) => {
    apQueue = apQueue.filter(p => p.id !== id);
    renderAdminPhotoGrid();
  };
  window.clearPhotoQueue = () => {
    apQueue = [];
    renderAdminPhotoGrid();
    const s = document.getElementById("statusMessage");
    if (s) s.textContent = "";
  };

  // ══════════════════════════════════════════════════════════
  //  Upload to Cloudinary
  // ══════════════════════════════════════════════════════════

  let _uploadCancelled = false;

  window.cancelUpload = function () {
    _uploadCancelled = true;
    apToast("⛔ Yükleme durduruluyor...");
    const stopBtn = document.getElementById("stopUploadBtn");
    if (stopBtn) stopBtn.disabled = true;
  };

  window.uploadToCloudinary = async function () {
    const occ = document.getElementById("manageOccasionSelector")?.value || "";
    const eventIdx = document.getElementById("manageEventSelector")?.value ?? "";
    if (!occ) return apToast("⚠️ Önce etkinliği seçin");
    if (eventIdx === "") return apToast("⚠️ Önce olayı seçin");
    const toProcess = apQueue.filter(p => p.status === "pending" || p.status === "existing");
    if (!toProcess.length) return apToast("Kuyrukta hiç fotoğraf yok");
    const existingPhotos = toProcess.filter(p => p.status === "existing");
    const pendingPhotos = toProcess.filter(p => p.status === "pending");
    if (existingPhotos.length > 0) {
      const srcOcc = existingPhotos[0].srcOcc;
      const srcEventIdx = existingPhotos[0].srcEventIdx;
      if (srcOcc === occ && String(srcEventIdx) === String(eventIdx)) {
        return apToast("⚠️ Kaynak ve hedef aynı — hedef etkinliği/olayı değiştirin");
      }
    }
    if (pendingPhotos.length > 0) {
      if (!_cfg.cloudName) return apToast("Cloud Name ayarlanmamış");
    }
    const progressWrap = document.getElementById("uploadProgressWrap");
    const progressBar = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl = document.getElementById("statusMessage");
    const stopBtn = document.getElementById("stopUploadBtn");
    _uploadCancelled = false;
    if (stopBtn) { stopBtn.style.display = "inline-flex"; stopBtn.disabled = false; }
    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    let done = 0, total = toProcess.length, successCount = 0, errorCount = 0;
    const ev = window.DATA[occ][parseInt(eventIdx)];
    if (!ev._fbKey) {
      const key = fbKey();
      await rtdb.ref("/albums/" + occ + "/" + key).set({ label: ev.label, order: parseInt(eventIdx), photos: {} });
      ev._fbKey = key;
    }
    async function uploadSinglePhoto(photo, idx) {
      if (_uploadCancelled) return "cancelled";
      photo.status = "uploading";
      renderAdminPhotoGrid();
      progressLabel.textContent = `Yükleniyor ${idx + 1}/${total}: ${photo.title || "Başlıksız"}`;
      try {
        const contextVal = photo.title ? `caption=${photo.title}` : null;
        const sigResponse = await fetch(`${FUNCTIONS_BASE_URL}/getCloudinarySignature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_preset: _cfg.preset || "ml_default", ...(contextVal ? { context: contextVal } : {}) }),
        });
        if (!sigResponse.ok) throw new Error(`Sunucu yanıt verdi ${sigResponse.status}`);
        const sigData = await sigResponse.json();
        if (!sigData.success) throw new Error(sigData.error || "İmza alınamadı");
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("api_key", sigData.api_key);
        formData.append("timestamp", sigData.timestamp);
        formData.append("signature", sigData.signature);
        formData.append("upload_preset", _cfg.preset || "ml_default");
        if (sigData.context) formData.append("context", sigData.context);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.secure_url) {
          const newPhotoData = { src: data.secure_url, title: photo.title };
          window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);
          await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);
          photo.status = "done";
          return "success";
        } else {
          throw new Error(data.error?.message || JSON.stringify(data));
        }
      } catch (err) {
        console.error(`❌ ${photo.title} yüklenemedi:`, err.message);
        photo.status = "error";
        return "error";
      }
    }
    for (const photo of toProcess.filter(p => p.status === "existing")) {
      if (_uploadCancelled) break;
      progressLabel.textContent = `Aktarılıyor: ${photo.title}`;
      const srcEv = window.DATA[photo.srcOcc]?.[photo.srcEventIdx];
      const srcArr = srcEv?.photos;
      if (!window.DATA[occ][parseInt(eventIdx)].photos) window.DATA[occ][parseInt(eventIdx)].photos = [];
      const newPhotoData = { src: photo.src, title: photo.title };
      window.DATA[occ][parseInt(eventIdx)].photos.push(newPhotoData);
      await addPhotoToFB(occ, parseInt(eventIdx), newPhotoData);
      if (srcEv?._fbKey && photo._fbPhotoKey) await deletePhotoFromFB(photo.srcOcc, srcEv._fbKey, photo._fbPhotoKey);
      if (srcArr) { const idx = srcArr.findIndex(x => x.src === photo.src); if (idx !== -1) srcArr.splice(idx, 1); }
      photo.status = "done";
      successCount++;
      done++;
      progressBar.style.width = Math.round((done / total) * 100) + "%";
      renderAdminPhotoGrid();
    }
    const pendingQueue = toProcess.filter(p => p.status === "pending" || p.status === "uploading");
    const CONCURRENCY = 3;
    async function runBatch(batch, startIdx) {
      const results = await Promise.all(batch.map((photo, i) => uploadSinglePhoto(photo, startIdx + i)));
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
        apToast(`⛔ Yükleme durduruldu. Başarılı: ${successCount} | Hatalı: ${errorCount}`);
        if (stopBtn) stopBtn.style.display = "none";
        return;
      }
      await runBatch(pendingQueue.slice(i, i + CONCURRENCY), i);
    }
    if (stopBtn) stopBtn.style.display = "none";
    apToast(`✅ İşlem tamamlandı. Başarılı: ${successCount} | Hatalı: ${errorCount}`);
  };

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
