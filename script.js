const state = {
      bestPlan: null,
      companyLookupTimer: null,
      suppressCompanyLookup: false
    };

    const COMPANY_API_BASE = "https://company.g0v.ronny.tw/api";

    const serviceTemplates = {
      consulting: {
        label: "顧問服務",
        items: ["專案顧問服務", "流程規劃服務", "分析報告撰寫", "會議諮詢服務", "執行建議整理"]
      },
      teaching: {
        label: "教學課程",
        items: ["課程規劃服務", "講師授課費", "教材設計製作", "課後諮詢服務", "學員資料整理"]
      },
      system: {
        label: "系統建置",
        items: ["系統功能建置", "網頁介面設計", "資料整理與設定", "測試與調整服務", "維護支援服務"]
      },
      design: {
        label: "設計製作",
        items: ["設計規劃服務", "視覺版面製作", "素材整理編修", "修正調整服務", "輸出檔案製作"]
      },
      event: {
        label: "活動執行",
        items: ["活動企劃服務", "現場執行服務", "物料設計製作", "行政協調服務", "成果資料整理"]
      },
      content: {
        label: "教材內容",
        items: ["內容架構規劃", "教材撰寫製作", "圖文編排服務", "內容校修服務", "交付資料整理"]
      },
      general: {
        label: "一般服務",
        items: ["專案服務費", "規劃執行服務", "資料整理服務", "文件製作服務", "後續支援服務"]
      }
    };

    const allocationProfiles = {
      "main-heavy": {
        label: "主服務占比較高",
        weights: {
          2: [0.68, 0.32],
          3: [0.56, 0.28, 0.16],
          4: [0.46, 0.25, 0.18, 0.11],
          5: [0.4, 0.23, 0.17, 0.12, 0.08]
        }
      },
      balanced: {
        label: "平均但不死板",
        weights: {
          2: [0.55, 0.45],
          3: [0.42, 0.33, 0.25],
          4: [0.34, 0.27, 0.22, 0.17],
          5: [0.3, 0.24, 0.2, 0.15, 0.11]
        }
      },
      "support-heavy": {
        label: "執行與輔助占比較高",
        weights: {
          2: [0.48, 0.52],
          3: [0.36, 0.34, 0.3],
          4: [0.3, 0.27, 0.23, 0.2],
          5: [0.26, 0.23, 0.2, 0.17, 0.14]
        }
      }
    };

    const body = document.getElementById("itemsBody");
    const money = new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0
    });

    const invoiceMasks = [
      { className: "mask-period-year" },
      { className: "mask-period-months" },
      { className: "mask-buyer" },
      { className: "mask-taxid" },
      { className: "mask-date-year" },
      { className: "mask-date-month" },
      { className: "mask-date-day" },
      { className: "mask-sales-total" },
      { className: "mask-tax-check" },
      { className: "mask-tax-total" },
      { className: "mask-grand-total" },
      { className: "mask-grand-chinese" },
      { className: "mask-item-name mask-row-1" },
      { className: "mask-item-qty mask-row-1" },
      { className: "mask-item-unit mask-row-1" },
      { className: "mask-item-amount mask-row-1" }
    ];

    function toNumber(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }

    function roundMoney(value) {
      return Math.round(value);
    }

    function getTaxRate() {
      return Math.max(0, toNumber(document.getElementById("taxRate").value)) / 100;
    }

    function format(value) {
      return money.format(roundMoney(value));
    }

    function todayValue() {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const date = String(now.getDate()).padStart(2, "0");
      return `${now.getFullYear()}-${month}-${date}`;
    }

    function makeRow(item = {}) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input class="name" type="text" placeholder="例如：顧問服務" value="${escapeHtml(item.name || "")}"></td>
        <td><input class="qty num" type="number" min="0" step="1" value="${item.qty ?? 1}"></td>
        <td><input class="unit num" type="number" min="0" step="1" value="${item.unit ?? 0}"></td>
        <td>
          <select class="priceType">
            <option value="untaxed"${(item.priceType || "untaxed") === "untaxed" ? " selected" : ""}>未稅</option>
            <option value="taxed"${item.priceType === "taxed" ? " selected" : ""}>含稅</option>
          </select>
        </td>
        <td>
          <select class="taxType">
            <option value="taxable"${(item.taxType || "taxable") === "taxable" ? " selected" : ""}>應稅</option>
            <option value="zero"${item.taxType === "zero" ? " selected" : ""}>零稅率</option>
            <option value="exempt"${item.taxType === "exempt" ? " selected" : ""}>免稅</option>
          </select>
        </td>
        <td class="num untaxedSubtotal">$0</td>
        <td class="num taxAmount">$0</td>
        <td class="num taxedSubtotal">$0</td>
        <td><input class="adjustable" type="checkbox"${item.adjustable === false ? "" : " checked"} title="允許目標金額反推調整此品項數量"></td>
        <td><button type="button" class="danger remove">刪除</button></td>
      `;
      tr.addEventListener("input", updateTotals);
      tr.addEventListener("change", updateTotals);
      tr.querySelector(".remove").addEventListener("click", () => {
        if (body.children.length === 1) {
          tr.querySelector(".name").value = "";
          tr.querySelector(".qty").value = 1;
          tr.querySelector(".unit").value = 0;
          tr.querySelector(".priceType").value = "untaxed";
          tr.querySelector(".taxType").value = "taxable";
          tr.querySelector(".adjustable").checked = true;
        } else {
          tr.remove();
        }
        updateTotals();
      });
      body.appendChild(tr);
      updateTotals();
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function readRows() {
      return [...body.querySelectorAll("tr")].map((tr) => {
        const qty = Math.max(0, toNumber(tr.querySelector(".qty").value));
        const unit = Math.max(0, toNumber(tr.querySelector(".unit").value));
        const priceType = tr.querySelector(".priceType").value;
        const taxType = tr.querySelector(".taxType").value;
        const adjustable = tr.querySelector(".adjustable").checked;
        const name = tr.querySelector(".name").value.trim() || "未命名品項";
        return { tr, name, qty, unit, priceType, taxType, adjustable };
      });
    }

    function rowAmounts(row, taxRate = getTaxRate()) {
      const effectiveTaxRate = row.taxType === "taxable" ? taxRate : 0;
      const taxedUnit = row.priceType === "taxed" ? row.unit : row.unit * (1 + effectiveTaxRate);
      const untaxedUnit = row.priceType === "taxed" && effectiveTaxRate > 0 ? row.unit / (1 + effectiveTaxRate) : row.unit;
      const untaxed = roundMoney(untaxedUnit * row.qty);
      const taxed = roundMoney(taxedUnit * row.qty);
      return {
        untaxed,
        taxed,
        tax: Math.max(0, taxed - untaxed),
        unitForTargetTaxed: roundMoney(taxedUnit),
        unitForTargetUntaxed: roundMoney(untaxedUnit)
      };
    }

    function updateTotals() {
      const taxRate = getTaxRate();
      const rows = readRows();
      let subtotal = 0;
      let taxTotal = 0;
      let total = 0;
      let activeCount = 0;

      rows.forEach((row) => {
        const amount = rowAmounts(row, taxRate);
        row.tr.querySelector(".untaxedSubtotal").textContent = format(amount.untaxed);
        row.tr.querySelector(".taxAmount").textContent = format(amount.tax);
        row.tr.querySelector(".taxedSubtotal").textContent = format(amount.taxed);
        subtotal += amount.untaxed;
        taxTotal += amount.tax;
        total += amount.taxed;
        if (row.unit > 0 && row.qty > 0) activeCount += 1;
      });

      document.getElementById("subtotal").textContent = format(subtotal);
      document.getElementById("tax").textContent = format(taxTotal);
      document.getElementById("total").textContent = format(total);
      document.getElementById("itemCount").textContent = String(activeCount);
      document.getElementById("totalChinese").textContent = toChineseMoney(total);
      updateBuyerMode();
      updateValidation(rows, { subtotal, taxTotal, total, activeCount });
      updatePrintPreview(rows, { subtotal, taxTotal, total });
    }

    function updateBuyerMode() {
      const invoiceType = document.getElementById("invoiceType").value;
      const buyerFields = document.getElementById("buyerFields");
      buyerFields.style.display = invoiceType === "triplicate" ? "grid" : "none";
      const taxId = document.getElementById("buyerTaxId").value.trim();
      const status = document.getElementById("taxIdStatus");
      if (!taxId) {
        status.textContent = invoiceType === "triplicate" ? "三聯式建議填寫 8 碼統編。" : "";
        status.className = "status";
      } else if (isValidTaxId(taxId)) {
        status.textContent = "統編格式通過。";
        status.className = "status";
      } else {
        status.textContent = "統編格式可能有誤，請確認 8 碼與檢查碼。";
        status.className = "status error";
      }
    }

    function scheduleCompanyLookup(mode) {
      if (state.suppressCompanyLookup) return;
      clearTimeout(state.companyLookupTimer);
      state.companyLookupTimer = setTimeout(() => {
        if (mode === "taxId") lookupCompanyByTaxId();
        if (mode === "name") lookupCompanyByName();
      }, 550);
    }

    async function lookupCompanyByTaxId() {
      const taxId = document.getElementById("buyerTaxId").value.trim();
      const resultsBox = document.getElementById("companyLookupResults");
      if (!/^\d{8}$/.test(taxId)) {
        hideCompanyResults();
        return;
      }
      setLookupMessage("正在用統編查詢公開公司資料...");
      try {
        const response = await fetch(`${COMPANY_API_BASE}/show/${encodeURIComponent(taxId)}`);
        if (!response.ok) throw new Error("lookup failed");
        const payload = await response.json();
        const company = normalizeCompanyRecord(payload.data, taxId);
        if (!company.name) {
          setLookupMessage("查無對應公司資料，請確認統編或手動填寫。", true);
          return;
        }
        applyCompanyResult(company);
        renderCompanyResults([company], "已依統編帶入公司資料。");
      } catch {
        resultsBox.classList.add("active");
        resultsBox.innerHTML = `<div class="check-item error">公司資料查詢失敗。可能是網路、公開資料來源或瀏覽器阻擋造成，仍可手動填寫。</div>`;
      }
    }

    async function lookupCompanyByName() {
      const keyword = document.getElementById("buyerName").value.trim();
      if (keyword.length < 2) {
        hideCompanyResults();
        return;
      }
      setLookupMessage("正在用公司名稱搜尋公開公司資料...");
      try {
        const response = await fetch(`${COMPANY_API_BASE}/search?q=${encodeURIComponent(keyword)}`);
        if (!response.ok) throw new Error("lookup failed");
        const payload = await response.json();
        const companies = (payload.data || [])
          .map((record) => normalizeCompanyRecord(record, record["統一編號"]))
          .filter((company) => company.name && company.taxId)
          .slice(0, 8);
        if (!companies.length) {
          setLookupMessage("查無相近公司名稱，請換關鍵字或手動填寫。", true);
          return;
        }
        renderCompanyResults(companies, `找到 ${companies.length} 筆候選公司，請選擇要套用的資料。`);
      } catch {
        const resultsBox = document.getElementById("companyLookupResults");
        resultsBox.classList.add("active");
        resultsBox.innerHTML = `<div class="check-item error">公司名稱查詢失敗。可能是網路、公開資料來源或瀏覽器阻擋造成，仍可手動填寫。</div>`;
      }
    }

    function normalizeCompanyRecord(record, fallbackTaxId = "") {
      if (!record || typeof record !== "object") return { name: "", taxId: fallbackTaxId, address: "" };
      const finance = record["財政部"] || {};
      return {
        name: finance["營業人名稱"] || record["公司名稱"] || record["商業名稱"] || "",
        taxId: String(record["統一編號"] || fallbackTaxId || "").trim(),
        address: finance["營業地址"] || record["公司所在地"] || record["商業所在地"] || ""
      };
    }

    function renderCompanyResults(companies, heading) {
      const resultsBox = document.getElementById("companyLookupResults");
      resultsBox.classList.add("active");
      resultsBox.innerHTML = `
        <div class="check-item ok">${escapeHtml(heading)}<br>資料來源：company.g0v.ronny.tw 公開資料整理服務。</div>
        ${companies.map((company, index) => `
          <div class="lookup-result">
            <div>
              <strong>${escapeHtml(company.name)}</strong>
              <span>統編：${escapeHtml(company.taxId || "未提供")}</span><br>
              <span>${escapeHtml(company.address || "未提供地址")}</span>
            </div>
            <button type="button" class="secondary" data-company-index="${index}">套用</button>
          </div>
        `).join("")}
      `;
      [...resultsBox.querySelectorAll("[data-company-index]")].forEach((button) => {
        button.addEventListener("click", () => {
          applyCompanyResult(companies[Number(button.dataset.companyIndex)]);
          setLookupMessage("已套用公司資料。");
        });
      });
    }

    function applyCompanyResult(company) {
      state.suppressCompanyLookup = true;
      document.getElementById("buyerName").value = company.name || "";
      document.getElementById("buyerTaxId").value = company.taxId || "";
      document.getElementById("buyerAddress").value = company.address || "";
      updateTotals();
      state.suppressCompanyLookup = false;
    }

    function setLookupMessage(message, isWarning = false) {
      const resultsBox = document.getElementById("companyLookupResults");
      resultsBox.classList.add("active");
      resultsBox.innerHTML = `<div class="check-item ${isWarning ? "warn" : "ok"}">${escapeHtml(message)}</div>`;
    }

    function hideCompanyResults() {
      const resultsBox = document.getElementById("companyLookupResults");
      resultsBox.classList.remove("active");
      resultsBox.innerHTML = "";
    }

    function updateValidation(rows, totals) {
      const box = document.getElementById("validationBox");
      const invoiceType = document.getElementById("invoiceType").value;
      const buyerName = document.getElementById("buyerName").value.trim();
      const buyerTaxId = document.getElementById("buyerTaxId").value.trim();
      const activeRows = rows.filter((row) => row.unit > 0 && row.qty > 0);
      const taxTypes = new Set(activeRows.map((row) => row.taxType));
      const messages = [];

      if (activeRows.length) {
        messages.push({ type: "ok", text: `已有 ${activeRows.length} 個有效品項，含稅總額 ${format(totals.total)}。` });
      } else {
        messages.push({ type: "error", text: "請至少輸入一個有數量與單價的品項。" });
      }

      if (invoiceType === "triplicate") {
        if (!buyerName) messages.push({ type: "warn", text: "三聯式發票建議填寫買受人名稱。" });
        if (!isValidTaxId(buyerTaxId)) messages.push({ type: "error", text: "三聯式發票請確認買受人統一編號。" });
      } else if (activeRows.some((row) => row.taxType === "taxable" && row.priceType === "untaxed")) {
        messages.push({ type: "warn", text: "二聯式通常以定價開立；若是給非營業人，請確認手寫金額欄位要填含稅總額。" });
      } else {
        messages.push({ type: "ok", text: "二聯式模式會隱藏買受人統編欄位，適合非營業人收執。" });
      }

      if (taxTypes.size > 1) {
        messages.push({ type: "warn", text: "目前同一張草稿含有不同稅別。正式開立前請確認是否需要分開開立。" });
      }

      if (activeRows.some((row) => row.taxType !== "taxable" && row.priceType === "taxed")) {
        messages.push({ type: "warn", text: "零稅率或免稅品項的含稅單價會視為不加稅金額。" });
      }

      box.innerHTML = messages.map((message) => `<div class="check-item ${message.type}">${escapeHtml(message.text)}</div>`).join("");
    }

    function isValidTaxId(value) {
      if (!/^\d{8}$/.test(value)) return false;
      const weights = [1, 2, 1, 2, 1, 2, 4, 1];
      const digits = value.split("").map(Number);
      const sum = digits.reduce((total, digit, index) => {
        const product = digit * weights[index];
        return total + Math.floor(product / 10) + (product % 10);
      }, 0);
      if (sum % 10 === 0) return true;
      if (digits[6] === 7) return (sum + 1) % 10 === 0;
      return false;
    }

    function toChineseMoney(value) {
      const digits = ["零", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
      const units = ["", "拾", "佰", "仟"];
      const sections = ["", "萬", "億", "兆"];
      let number = Math.max(0, roundMoney(value));
      if (number === 0) return "零元整";
      let result = "";
      let sectionIndex = 0;
      while (number > 0) {
        const section = number % 10000;
        if (section !== 0) {
          result = sectionToChinese(section, digits, units) + sections[sectionIndex] + result;
        } else if (!result.startsWith("零")) {
          result = "零" + result;
        }
        number = Math.floor(number / 10000);
        sectionIndex += 1;
      }
      return result.replace(/零+/g, "零").replace(/零(萬|億|兆)/g, "$1").replace(/零$/, "") + "元整";
    }

    function sectionToChinese(section, digits, units) {
      let text = "";
      let zeroPending = false;
      for (let index = 3; index >= 0; index -= 1) {
        const unitValue = Math.pow(10, index);
        const digit = Math.floor(section / unitValue) % 10;
        if (digit === 0) {
          if (text) zeroPending = true;
        } else {
          if (zeroPending) {
            text += "零";
            zeroPending = false;
          }
          text += digits[digit] + units[index];
        }
      }
      return text;
    }

    function generateSuggestions() {
      updateTotals();
      const target = roundMoney(toNumber(document.getElementById("targetAmount").value));
      const targetType = document.getElementById("targetType").value;
      const serviceType = document.getElementById("serviceType").value;
      const splitCount = Math.max(2, Math.min(5, Math.floor(toNumber(document.getElementById("splitCount").value) || 3)));
      const allocationStyle = document.getElementById("allocationStyle").value;
      const box = document.getElementById("suggestions");
      state.bestPlan = null;

      if (!target || target <= 0) {
        box.innerHTML = `<p class="empty">請先輸入目標金額。</p>`;
        return;
      }

      const results = buildDraftPlans({
        target,
        targetType,
        serviceType,
        splitCount,
        allocationStyle
      });

      if (!results.length) {
        box.innerHTML = `<p class="empty">目前金額太小或設定不完整，請調整目標金額或拆分筆數。</p>`;
        return;
      }

      state.bestPlan = { mode: "draft", plan: results[0] };
      box.innerHTML = results.map((plan, index) => renderSuggestion(plan, target, index === 0)).join("");
    }

    function buildDraftPlans({ target, targetType, serviceType, splitCount, allocationStyle }) {
      const template = serviceTemplates[serviceType] || serviceTemplates.general;
      const baseProfile = allocationProfiles[allocationStyle] || allocationProfiles["main-heavy"];
      const profileOrder = [
        baseProfile,
        allocationProfiles["main-heavy"],
        allocationProfiles.balanced,
        allocationProfiles["support-heavy"]
      ].filter((profile, index, list) => list.findIndex((entry) => entry.label === profile.label) === index);

      return profileOrder
        .map((profile, index) => {
          const weights = profile.weights[splitCount] || allocationProfiles["main-heavy"].weights[splitCount];
          const lineTotals = distributeAmount(target, weights, index);
          const rows = lineTotals.map((amount, rowIndex) => ({
            name: template.items[rowIndex] || serviceTemplates.general.items[rowIndex],
            qty: 1,
            unit: amount,
            priceType: targetType,
            taxType: "taxable",
            adjustable: true
          }));
          const totals = calculatePlanTotals(rows);
          return {
            rows,
            profileLabel: profile.label,
            serviceLabel: template.label,
            targetType,
            total: targetType === "taxed" ? totals.total : totals.subtotal,
            displayTotal: totals.total,
            subtotal: totals.subtotal,
            tax: totals.taxTotal,
            score: scoreDraftPlan(rows, target, targetType, profile.label),
            diff: Math.abs(target - (targetType === "taxed" ? totals.total : totals.subtotal))
          };
        })
        .sort((a, b) => a.diff - b.diff || b.score.value - a.score.value)
        .slice(0, 4);
    }

    function distributeAmount(total, weights, variantIndex = 0) {
      let baseUnit = total >= 20000 ? 100 : 10;
      if (total < weights.length * baseUnit) baseUnit = 1;
      const amounts = weights.map((weight, index) => {
        if (index === weights.length - 1) return 0;
        const adjustedWeight = weight + (variantIndex * 0.015 * (index % 2 === 0 ? -1 : 1));
        return Math.max(baseUnit, Math.round((total * adjustedWeight) / baseUnit) * baseUnit);
      });
      const used = amounts.reduce((sum, amount) => sum + amount, 0);
      amounts[weights.length - 1] = Math.max(baseUnit, total - used);

      const diff = total - amounts.reduce((sum, amount) => sum + amount, 0);
      amounts[0] += diff;
      return amounts.map((amount) => Math.max(1, roundMoney(amount)));
    }

    function calculatePlanTotals(rows) {
      const taxRate = getTaxRate();
      return rows.reduce((totals, row) => {
        const amount = rowAmounts(row, taxRate);
        totals.subtotal += amount.untaxed;
        totals.taxTotal += amount.tax;
        totals.total += amount.taxed;
        return totals;
      }, { subtotal: 0, taxTotal: 0, total: 0 });
    }

    function scoreDraftPlan(rows, target, targetType, profileLabel) {
      let value = 100;
      const notes = [];
      const amounts = rows.map((row) => row.unit);
      const smallest = Math.min(...amounts);
      const largest = Math.max(...amounts);

      if (smallest < Math.max(500, target * 0.05)) {
        value -= 10;
        notes.push("有一筆金額偏小，正式開立前請確認是否必要。");
      }
      if (largest > target * 0.75) {
        value -= 8;
        notes.push("主項占比較高，適合主要服務明確的案件。");
      }
      if (amounts.some((amount) => amount % 10 !== 0)) {
        value -= 8;
        notes.push("有較零碎的單價，可能比較像硬湊。");
      }
      if (targetType === "taxed") {
        notes.push("此方案以含稅總額編列，適合客戶只給總價時使用。");
      } else {
        notes.push("此方案以未稅金額編列，系統會另外計算營業稅。");
      }
      notes.push(profileLabel);

      return {
        value: Math.max(0, value),
        label: value >= 90 ? "自然" : value >= 78 ? "可用" : "需確認",
        notes
      };
    }

    function renderSuggestion(plan, target, isBest) {
      const lines = plan.rows
        .map((row) => {
          const amount = rowAmounts(row);
          return `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td class="num">${formatPlain(row.qty)}</td>
              <td class="num">${format(row.unit)}</td>
              <td class="num">${format(amount.untaxed)}</td>
              <td class="num">${format(amount.taxed)}</td>
            </tr>
          `;
        })
        .join("");
      const targetLabel = plan.targetType === "taxed" ? "含稅總額" : "未稅金額";
      const diffText = plan.diff === 0 ? "完全符合目標金額" : `與目標差 ${format(plan.diff)}`;
      return `
        <div class="suggestion${isBest ? " best" : ""}">
          <div class="suggestion-topline">
            <h3>${isBest ? "最佳編列" : "備選編列"}：${escapeHtml(plan.serviceLabel)}</h3>
            <span>${escapeHtml(plan.score.label)}</span>
          </div>
          <p>${targetLabel} ${format(target)}，${diffText}。${escapeHtml(plan.profileLabel)}。</p>
          <table class="suggestion-lines">
            <thead>
              <tr>
                <th>品項</th>
                <th>數量</th>
                <th>單價</th>
                <th>未稅</th>
                <th>含稅</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
          <div class="suggestion-total">
            <span>銷售額 ${format(plan.subtotal)}</span>
            <span>稅額 ${format(plan.tax)}</span>
            <strong>含稅 ${format(plan.displayTotal)}</strong>
          </div>
          <p class="suggestion-note">${plan.score.notes.map(escapeHtml).join("｜")}</p>
        </div>
      `;
    }

    function taxTypeLabel(value) {
      return {
        taxable: "應稅",
        zero: "零稅率",
        exempt: "免稅"
      }[value] || "應稅";
    }

    function priceTypeLabel(value) {
      return value === "taxed" ? "含稅" : "未稅";
    }

    function invoiceTypeLabel(value) {
      return value === "triplicate" ? "三聯式" : "二聯式";
    }

    function updatePrintPreview(rows, totals) {
      const activeRows = rows.filter((row) => row.unit > 0 && row.qty > 0);
      const invoiceType = document.getElementById("invoiceType").value;
      const invoiceDate = document.getElementById("invoiceDate").value;
      const invoiceNo = document.getElementById("invoiceNo").value.trim();
      const buyerName = document.getElementById("buyerName").value.trim();
      const buyerTaxId = document.getElementById("buyerTaxId").value.trim();
      const buyerAddress = document.getElementById("buyerAddress").value.trim();
      const memo = document.getElementById("invoiceMemo").value.trim();
      const taxRate = getTaxRate();
      const invoiceData = {
        activeRows,
        invoiceType,
        invoiceDate,
        invoiceNo,
        buyerName,
        buyerTaxId,
        buyerAddress,
        memo,
        taxRate,
        totals
      };
      document.getElementById("printPreview").innerHTML = `
        <div class="invoice-stack">${renderInvoicePaper(invoiceData)}</div>
        <div class="invoice-note">此票面為手開前填寫範例，只顯示一張三聯式統一發票樣式，方便把輸入資訊對照填入紙本發票。正式開立仍請以實際紙本格式與會計稅務規範為準。</div>
      `;
    }

    function renderInvoicePaper(data) {
      const rows = data.activeRows.slice(0, 6);
      while (rows.length < 6) rows.push(null);
      const taxTypes = new Set(data.activeRows.map((row) => row.taxType));
      const displayTaxType = taxTypes.size === 1 ? [...taxTypes][0] : "mixed";
      const dateParts = getRocDateParts(data.invoiceDate);
      const invoicePrefix = String(data.invoiceNo || "JB").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "JB";
      const buyerName = data.invoiceType === "triplicate" ? data.buyerName : "";
      const buyerTaxId = data.invoiceType === "triplicate" ? data.buyerTaxId : "";
      const buyerAddress = data.invoiceType === "triplicate" ? data.buyerAddress : "";
      const rowHtml = rows.map((row) => {
        if (!row) {
          return `
            <tr>
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          `;
        }
        const amount = rowAmounts(row, data.taxRate);
        return `
          <tr>
            <td class="item-name">${escapeHtml(row.name)}</td>
            <td class="num">${formatPlain(row.qty)}</td>
            <td class="num">${formatPlain(row.unit)}</td>
            <td class="num">${formatPlain(amount.untaxed)}</td>
            <td>${escapeHtml(data.memo)}</td>
          </tr>
        `;
      }).join("");

      return `
        <div class="invoice-paper invoice-template" aria-label="三聯式發票草稿預覽">
          <div class="invoice-title">
            <div class="invoice-code">${escapeHtml(invoicePrefix)}</div>
            <h2>統一發票（三聯式）</h2>
            <div></div>
          </div>
          <div class="invoice-period">${dateParts.periodYear}年　${dateParts.periodStart}、${dateParts.periodEnd}月份</div>
          <div class="invoice-head-row">
            <div>買受人：<span class="invoice-fill">${escapeHtml(buyerName)}</span></div>
            <div class="invoice-date-text">
              中華民國 <span class="invoice-fill">${dateParts.rocYear}</span> 年
              <span class="invoice-fill">${dateParts.month}</span> 月
              <span class="invoice-fill">${dateParts.day}</span> 日
            </div>
          </div>
          <div class="invoice-head-row">
            <div class="invoice-tax-id-line">
              <span>統一編號：</span>
              ${renderTaxIdBoxes(buyerTaxId)}
            </div>
            <div></div>
          </div>
          <div class="invoice-address-line">
            <span>地址：</span>
            <div class="invoice-address-rule">${escapeHtml(buyerAddress)}</div>
            <span class="invoice-address-optional">可省略</span>
          </div>
          <div class="invoice-main-grid">
            <div>
              <table class="invoice-lines">
                <thead>
                  <tr>
                    <th style="width: 40%;">品名</th>
                    <th style="width: 14%;">數量</th>
                    <th style="width: 16%;">單價</th>
                    <th style="width: 22%;">金額</th>
                    <th style="width: 8%;">備註</th>
                  </tr>
                </thead>
                <tbody>${rowHtml}</tbody>
              </table>
              <table class="invoice-total-table">
                <tr>
                  <td colspan="3">銷售額合計</td>
                  <td class="blue">${formatPlain(data.totals.subtotal)}</td>
                </tr>
                <tr>
                  <td>營業稅</td>
                  <td>${renderTaxCheck("應稅", displayTaxType === "taxable")}</td>
                  <td>${renderTaxCheck("零稅率", displayTaxType === "zero")} ${renderTaxCheck("免稅", displayTaxType === "exempt")} ${renderTaxCheck("混合", displayTaxType === "mixed")}</td>
                  <td class="blue">${formatPlain(data.totals.taxTotal)}</td>
                </tr>
                <tr>
                  <td colspan="3">總計</td>
                  <td class="blue">${formatPlain(data.totals.total)}</td>
                </tr>
              </table>
            </div>
            <div class="invoice-right-panel">
              <div class="invoice-note-box">營業人蓋用統一發票專用章</div>
              <div class="invoice-stamp-reminder">記得要蓋<br>發票章唷</div>
            </div>
          </div>
          <div class="invoice-grand-line">
            <span>總計新臺幣<br>（中文大寫）</span>
            <strong>${toChineseMoney(data.totals.total)}</strong>
            <span>元</span>
          </div>
          <div class="invoice-footer-tip">※應稅、零稅率、免稅之銷售額應分別開立統一發票，並應於各該欄打「✓」。</div>
        </div>
      `;
    }

    function renderInvoiceMasks() {
      return invoiceMasks.map((mask) => `<span class="invoice-mask ${mask.className}"></span>`).join("");
    }

    function renderInvoiceField(className, value, position = null) {
      const text = String(value ?? "").trim();
      if (!text) return "";
      const style = position ? ` style="top:${position.top}%;left:${position.left}%;width:${position.width}%;"` : "";
      return `<span class="invoice-field ${className}"${style}>${escapeHtml(text)}</span>`;
    }

    function renderTaxIdOverlay(value) {
      if (!/^\d{8}$/.test(String(value || ""))) return "";
      const chars = String(value || "").slice(0, 8).split("");
      return `
        <div class="invoice-taxid-overlay">
          ${chars.map((char) => `<span>${escapeHtml(char)}</span>`).join("")}
        </div>
      `;
    }

    function getRocDateParts(value) {
      const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date();
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const periodStart = month % 2 === 0 ? month - 1 : month;
      const periodEnd = periodStart + 1;
      return {
        rocYear: year - 1911,
        month,
        day,
        periodYear: year - 1911,
        periodStart,
        periodEnd
      };
    }

    function renderTaxIdBoxes(value) {
      const chars = String(value || "").padEnd(8, " ").slice(0, 8).split("");
      return `<div class="tax-id-boxes">${chars.map((char) => `<span>${escapeHtml(char.trim())}</span>`).join("")}</div>`;
    }

    function renderTaxCheck(label, checked) {
      return `<span class="invoice-check"><span>${checked ? "✓" : ""}</span>${label}</span>`;
    }

    function formatPlain(value) {
      return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(roundMoney(value));
    }

    function applyBestPlan() {
      if (!state.bestPlan) {
        generateSuggestions();
      }
      if (!state.bestPlan) return;

      if (state.bestPlan.mode === "draft") {
        body.innerHTML = "";
        state.bestPlan.plan.rows.forEach((row) => makeRow(row));
      }
      updateTotals();
    }

    async function copySummary() {
      updateTotals();
      const taxRate = getTaxRate();
      const rows = readRows().filter((row) => row.unit > 0 && row.qty > 0);
      const invoiceType = document.getElementById("invoiceType").value;
      const lines = rows.map((row) => {
        const amount = rowAmounts(row, taxRate);
        return `${row.name}｜數量 ${row.qty}｜單價 ${format(row.unit)}（${priceTypeLabel(row.priceType)}）｜稅別 ${taxTypeLabel(row.taxType)}｜銷售額 ${format(amount.untaxed)}｜稅額 ${format(amount.tax)}｜含稅小計 ${format(amount.taxed)}`;
      });
      lines.unshift(`發票類型：${invoiceTypeLabel(invoiceType)}`);
      lines.unshift(`開立日期：${document.getElementById("invoiceDate").value || "未填"}`);
      if (invoiceType === "triplicate") {
        lines.unshift(`買受人統編：${document.getElementById("buyerTaxId").value.trim() || "未填"}`);
        lines.unshift(`買受人：${document.getElementById("buyerName").value.trim() || "未填"}`);
      }
      lines.push(`未稅合計：${document.getElementById("subtotal").textContent}`);
      lines.push(`營業稅：${document.getElementById("tax").textContent}`);
      lines.push(`含稅總額：${document.getElementById("total").textContent}`);
      lines.push(`中文大寫：${document.getElementById("totalChinese").textContent}`);

      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        document.getElementById("copySummary").textContent = "已複製";
        setTimeout(() => document.getElementById("copySummary").textContent = "複製摘要", 1200);
      } catch {
        alert(lines.join("\n"));
      }
    }

    document.getElementById("addRow").addEventListener("click", () => makeRow());
    document.getElementById("copySummary").addEventListener("click", copySummary);
    document.getElementById("lookupByTaxId").addEventListener("click", lookupCompanyByTaxId);
    document.getElementById("printInvoice").addEventListener("click", () => {
      updateTotals();
      window.print();
    });
    document.getElementById("suggest").addEventListener("click", generateSuggestions);
    document.getElementById("applyBest").addEventListener("click", applyBestPlan);
    document.getElementById("taxRate").addEventListener("input", updateTotals);
    document.getElementById("targetAmount").addEventListener("input", () => {
      state.bestPlan = null;
    });
    document.getElementById("targetType").addEventListener("change", generateSuggestions);
    document.getElementById("serviceType").addEventListener("change", generateSuggestions);
    document.getElementById("splitCount").addEventListener("change", generateSuggestions);
    document.getElementById("allocationStyle").addEventListener("change", generateSuggestions);
    [
      "invoiceType",
      "invoiceDate",
      "invoiceNo",
      "invoiceMemo",
      "buyerName",
      "buyerTaxId",
      "buyerAddress"
    ].forEach((id) => {
      document.getElementById(id).addEventListener("input", updateTotals);
      document.getElementById(id).addEventListener("change", updateTotals);
    });
    document.getElementById("buyerTaxId").addEventListener("input", () => {
      const field = document.getElementById("buyerTaxId");
      field.value = field.value.replace(/\D/g, "").slice(0, 8);
      if (field.value.length === 8) scheduleCompanyLookup("taxId");
    });
    document.getElementById("buyerName").addEventListener("input", () => scheduleCompanyLookup("name"));

    document.getElementById("invoiceDate").value = todayValue();
    makeRow();
    updateTotals();
