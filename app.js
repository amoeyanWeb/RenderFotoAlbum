/* ════════ ADMIN PANEL ════════ */
(function () {
  // ══════════════════════════════════════════════════════
  //  آدرس بک‌اند جنگو
  // ══════════════════════════════════════════════════════
  // const API_BASE = "http://127.0.0.1:8000/api";
  const API_BASE = "/api";
  // ══════════════════════════════════════════════════════

  // تنظیمات کلودینری — بعد از لاگین ادمین از بک‌اند لود می‌شود
  let _cloudinaryConfig = null;

  let apQueue = [];
  let pwdTargetType = "";

  // خواندن تنظیمات کلودینری (از حافظه داخلی، پس از fetch)
  function cfg(k) {
    if (_cloudinaryConfig && _cloudinaryConfig[k] !== undefined)
      return _cloudinaryConfig[k];
    return "";
  }

  // ══════════ System Login (از بک‌اند) ══════════

  window.doSystemLogin = async function () {
    const u = document.getElementById("lgUser").value.trim();
    const p = document.getElementById("lgPass").value;
    const errEl = document.getElementById("lgErr");
    errEl.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/login/system/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById("initialLoginModal").style.display = "none";
        sessionStorage.setItem("initialLoggedIn", "true");
      } else {
        errEl.textContent = data.error || "نام کاربری یا رمز اشتباه است";
      }
    } catch {
      errEl.textContent = "خطا در اتصال به سرور";
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    const isLogged = sessionStorage.getItem("initialLoggedIn");
    const systemModal = document.getElementById("initialLoginModal");
    if (systemModal) {
      if (isLogged === "true") {
        systemModal.style.display = "none";
      } else {
        systemModal.style.setProperty("display", "flex", "important");
      }
    }

    const myToast = document.getElementById("apToast");
    if (myToast) myToast.style.display = "none";
  });

  // ══════════ Admin Panel Open/Close ══════════

  window.openAdmin = function () {
    // اگر لاگین اولیه انجام نشده، modal ورود را نشان بده نه پنل ادمین
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
    errEl.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/login/admin/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!data.ok) {
        errEl.textContent = data.error || "نام کاربری یا رمز اشتباه است";
        return;
      }

      // لود کلیدهای کلودینری از بک‌اند
      const cfgRes = await fetch(`${API_BASE}/config/cloudinary/`);
      _cloudinaryConfig = await cfgRes.json();

      document.getElementById("loginCard").style.display = "none";

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
    } catch {
      errEl.textContent = "خطا در اتصال به سرور";
    }
  };

  window.closeAdmin = function () {
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginCard").style.display = "none";

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

    // نمایش تنظیمات فعلی کلودینری (فقط read-only برای اطمینان)
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

  // ══════════ Cloudinary Settings (override در صورت نیاز) ══════════

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

    showCfgStatus("✅ تنظیمات ذخیره شد", "green");
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

  // ══════════ Password Modal ══════════

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
      (id) => {
        document.getElementById(id).value = "";
      },
    );
    document.getElementById("pwdErr").textContent = "";
    document.getElementById("pwdChangeOverlay").classList.add("open");
  };

  window.closePwdModal = function () {
    document.getElementById("pwdChangeOverlay").classList.remove("open");
    pwdTargetType = "";
  };

  window.applyPwdChange = function () {
    const newUser = document.getElementById("pwdNewUser").value.trim();
    const currentPass = document.getElementById("pwdCurrentPass").value;
    const newPass = document.getElementById("pwdNewPass").value;
    const confirmPass = document.getElementById("pwdConfirmPass").value;
    const errEl = document.getElementById("pwdErr");
    errEl.textContent = "";

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

    setCfg(uKey, newUser);
    setCfg(pKey, newPass);
    apToast("✅ اطلاعات ورود با موفقیت تغییر کرد");
    closePwdModal();
  };

  document.getElementById("pwdChangeOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closePwdModal();
  });

  // ══════════ Selectors ══════════

  function refreshAllSelectors() {
    const savedExtra = localStorage.getItem("persianLabels");
    if (savedExtra) Object.assign(window.LABELS, JSON.parse(savedExtra));

    ["eventOccasionSelector", "manageOccasionSelector", "selOccasion"].forEach(
      (id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        const placeholder =
          id === "selOccasion" ? "— انتخاب مناسبت —" : "انتخاب مناسبت...";
        sel.innerHTML = `<option value="">${placeholder}</option>`;
        Object.keys(DATA).forEach((key) => {
          const opt = document.createElement("option");
          opt.value = key;
          opt.textContent = window.LABELS[key] || key;
          sel.appendChild(opt);
        });
        if (current) sel.value = current;
      },
    );

    if (typeof window.updateEventSelector === "function")
      window.updateEventSelector();
  }

  window.updateEventSelector = function () {
    const manageOccasionSel = document.getElementById("manageOccasionSelector");
    const manageEventSel = document.getElementById("manageEventSelector");
    if (!manageOccasionSel || !manageEventSel) return;

    const occ = manageOccasionSel.value;
    const currentVal = manageEventSel.value;

    manageEventSel.innerHTML = '<option value="">انتخاب رویداد...</option>';
    if (!occ || !DATA[occ]) return;

    DATA[occ].forEach(function (group, i) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = group.label;
      manageEventSel.appendChild(o);
    });

    if (
      currentVal &&
      manageEventSel.querySelector('option[value="' + currentVal + '"]')
    ) {
      manageEventSel.value = currentVal;
    }
  };

  // ══════════ Create Occasion / Event ══════════

  window.createNewOccasion = function () {
    const persianName = document.getElementById("newOccasionName").value.trim();
    let englishKey = document
      .getElementById("newOccasionRef")
      .value.trim()
      .toLowerCase();
    if (!persianName) return apToast("نام فارسی را وارد کنید");
    if (!englishKey)
      englishKey = persianName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
    if (DATA[englishKey]) return apToast("این مناسبت وجود دارد");
    DATA[englishKey] = [];
    window.LABELS[englishKey] = persianName;
    window.persianLabels = window.persianLabels || {};
    window.persianLabels[englishKey] = persianName;
    localStorage.setItem("persianLabels", JSON.stringify(window.persianLabels));
    refreshAllSelectors();
    document.getElementById("newOccasionName").value = "";
    document.getElementById("newOccasionRef").value = "";
    apToast(`✅ مناسبت "${persianName}" ایجاد شد`);
    downloadUpdatedIndex();
  };

  window.createNewEvent = function () {
    const occ = document.getElementById("eventOccasionSelector").value;
    const label = document.getElementById("newEventName").value.trim();
    if (!occ) return apToast("مناسبت را انتخاب کنید");
    if (!label) return apToast("نام رویداد را وارد کنید");
    if (!DATA[occ]) DATA[occ] = [];
    DATA[occ].push({ label, photos: [] });
    apToast(`✅ رویداد "${label}" اضافه شد`);
    document.getElementById("newEventName").value = "";
    refreshAllSelectors();
    downloadUpdatedIndex();
  };

  // ══════════ Fetch Event Photos (دکمه فراخوانی) ══════════

  window.fetchEventPhotos = function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const event = DATA[occ][eventIdx];
    if (!event) return apToast("رویداد پیدا نشد");
    const photos = event.photos || [];

    apQueue = [];
    const grid = document.getElementById("adminPhotoGrid");
    if (!grid) return;

    if (photos.length === 0) {
      grid.innerHTML =
        '<p style="color:#a07850;font-size:0.85rem;padding:8px">این رویداد هنوز عکسی ندارد</p>';
      apToast(`رویداد "${event.label}" — بدون عکس`);
      return;
    }

    grid.innerHTML = photos
      .map(
        (p, i) => `
      <div class="apg-item" id="existing-${i}">
        <div class="apg-badge apg-done">✓</div>
        <img src="${p.src}" alt="${p.title}" loading="lazy">
        <input class="apg-title" type="text" value="${(p.title || "").replace(/"/g, "&quot;")}"
          placeholder="عنوان عکس"
          onchange="updateExistingPhotoTitle('${occ}',${eventIdx},${i},this.value)">
        <button class="apg-del" onclick="deleteExistingPhoto('${occ}',${eventIdx},${i})" title="حذف">🗑</button>
      </div>
    `,
      )
      .join("");

    apToast(`✅ رویداد "${event.label}" — ${photos.length} عکس`);
  };

  window.updateExistingPhotoTitle = function (
    occ,
    eventIdx,
    photoIdx,
    newTitle,
  ) {
    if (DATA[occ]?.[eventIdx]?.photos?.[photoIdx] !== undefined) {
      DATA[occ][eventIdx].photos[photoIdx].title = newTitle;
    }
  };

  // ══════════ Cloudinary Delete Helper ══════════
  // returns: "ok" | "skip" | "error"
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
      if (result.result === "ok") return "ok";
      console.warn("Cloudinary delete failed:", publicId, result);
      return "error";
    } catch (err) {
      console.error("Cloudinary delete error:", err);
      return "error";
    }
  }

  window.deleteExistingPhoto = async function (occ, eventIdx, photoIdx) {
    if (!confirm("این عکس از رویداد و کلودینری حذف شود؟")) return;
    if (!DATA[occ]?.[eventIdx]) return;

    const photo = DATA[occ][eventIdx].photos[photoIdx];
    if (photo) {
      const r = await cloudinaryDelete(photo.src);
      if (r === "ok") apToast("🗑 عکس از کلودینری و آلبوم حذف شد");
      else if (r === "skip")
        apToast("🗑 عکس از آلبوم حذف شد (API Key/Secret تنظیم نشده)");
      else apToast("🗑 عکس از آلبوم حذف شد (خطا در کلودینری)");
    }

    DATA[occ][eventIdx].photos.splice(photoIdx, 1);
    window.fetchEventPhotos();
    downloadUpdatedIndex();
  };

  // ══════════ File Queue ══════════

  window.handleFileSelect = function (e) {
    const imgs = [...e.target.files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return apToast("فایل تصویری انتخاب کنید");
    imgs.forEach((file) => {
      const id = "q" + Date.now() + Math.random().toString(36).slice(2, 6);
      const reader = new FileReader();
      reader.onload = (ev) => {
        apQueue.push({
          id,
          file,
          preview: ev.target.result,
          title: file.name.replace(/\.[^.]+$/, ""),
          status: "pending",
        });
        renderAdminPhotoGrid();
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
      .map((p) => {
        const s =
          p.status === "done"
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

  // ══════════ Upload to Cloudinary ══════════

  window.uploadToCloudinary = async function () {
    const occ = document.getElementById("manageOccasionSelector")?.value || "";
    const eventIdx =
      document.getElementById("manageEventSelector")?.value ?? "";

    if (!occ) return apToast("⚠️ ابتدا مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("⚠️ ابتدا رویداد را انتخاب کنید");

    const pending = apQueue.filter((p) => p.status === "pending");
    if (!pending.length) return apToast("هیچ عکسی در صف آپلود وجود ندارد");

    const cloudName = cfg("cloudName");
    const preset = cfg("preset");
    if (!cloudName) return apToast("Cloud Name تنظیم نشده");
    if (!preset) return apToast("Upload Preset تنظیم نشده");

    const progressWrap = document.getElementById("uploadProgressWrap");
    const progressBar = document.getElementById("uploadProgressBar");
    const progressLabel = document.getElementById("uploadProgressLabel");
    const statusEl = document.getElementById("statusMessage");

    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    let done = 0,
      total = pending.length;

    for (const photo of pending) {
      photo.status = "uploading";
      renderAdminPhotoGrid();
      progressLabel.textContent = `آپلود ${done + 1} از ${total}: ${photo.title}`;
      try {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("upload_preset", preset);
        formData.append("context", `caption=${photo.title}`);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData },
        );
        const data = await res.json();
        if (data.secure_url) {
          DATA[occ][eventIdx].photos.push({
            src: data.secure_url,
          });
          photo.status = "done";
        } else {
          photo.status = "error";
          console.error("Cloudinary error:", data);
        }
      } catch (err) {
        photo.status = "error";
        console.error("Upload failed:", err);
      }
      done++;
      progressBar.style.width = Math.round((done / total) * 100) + "%";
      renderAdminPhotoGrid();
    }

    const successCount = apQueue.filter((p) => p.status === "done").length;
    const errorCount = apQueue.filter((p) => p.status === "error").length;

    progressLabel.textContent = "آپلود تمام شد";
    statusEl.textContent =
      `✅ ${successCount} عکس آپلود شد` +
      (errorCount ? ` — ❌ ${errorCount} خطا` : "");
    apToast(`✅ ${successCount} عکس با موفقیت آپلود شد`);

    apQueue = [];
    renderAdminPhotoGrid();
    setTimeout(() => {
      progressWrap.style.display = "none";
    }, 2000);
    downloadUpdatedIndex();
  };

  // ══════════ Delete Entire Event + Cloudinary ══════════

  window.deleteEntireEvent = async function () {
    const occ = document.getElementById("manageOccasionSelector").value;
    const eventIdx = document.getElementById("manageEventSelector").value;
    if (!occ) return apToast("مناسبت را انتخاب کنید");
    if (eventIdx === "") return apToast("رویداد را انتخاب کنید");

    const event = DATA[occ][eventIdx];
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

    DATA[occ].splice(eventIdx, 1);
    refreshAllSelectors();
    downloadUpdatedIndex();
  };

  // ══════════ Toast ══════════

  window.apToast = function (msg) {
    const t = document.getElementById("apToast");
    if (!t) return;
    t.style.display = "";
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove("show"), 4000);
  };

  // ══════════ Download Updated data.js ══════════

  function downloadUpdatedIndex() {
    downloadUpdatedData();
  }

  function downloadUpdatedData() {
    const progressLabel = document.getElementById("uploadProgressLabel");
    if (progressLabel) progressLabel.textContent = "";
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) statusEl.textContent = "";

    const dataContent =
      "// ═══════════════════════════════════════════════════════════\n" +
      "//  data.js — فایل داده‌های آلبوم\n" +
      "//  این فایل توسط ادمین به‌روزرسانی می‌شود و نباید دستی ویرایش شود\n" +
      "// ═══════════════════════════════════════════════════════════\n\n" +
      "var DATA = " + JSON.stringify(DATA, null, 2) + ";\n\n" +
      "var LABELS = " + JSON.stringify(window.LABELS, null, 2) + ";\n";

    const blob = new Blob([dataContent], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.js";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ══════════ Admin Overlay Close ══════════

  const adminOverlay = document.getElementById("adminOverlay");
  if (adminOverlay) {
    adminOverlay.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeAdmin();
    });
  }
})();

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
