(() => {
  const workspace = document.querySelector(".workspace-panel");
  const settingsHeading = workspace.querySelector(".settings-title");
  workspace.insertBefore(workspace.querySelector(".buyer-title"), settingsHeading);
  workspace.insertBefore(document.getElementById("buyerFields"), settingsHeading);
  const editorFooter = workspace.querySelector(".editor-footer");
  workspace.insertBefore(workspace.querySelector(".summary"), editorFooter);
  workspace.insertBefore(document.getElementById("validationBox"), editorFooter);
  workspace.insertBefore(document.getElementById("draftFiles"), editorFooter);
  workspace.insertBefore(document.getElementById("invoiceMemo").closest("label"), workspace.querySelector(".summary"));
  document.getElementById("invoiceMemo").closest("label").classList.add("memo-field");
  const editorBottom = document.createElement("div");
  editorBottom.className = "editor-bottom";
  workspace.insertBefore(editorBottom, workspace.querySelector(".memo-field"));
  editorBottom.append(workspace.querySelector(".memo-field"), workspace.querySelector(".summary"));
  document.querySelector(".side-body").appendChild(document.querySelector(".notice"));
  document.querySelector('a[href="#draftFiles"]').addEventListener("click", () => {
    document.getElementById("draftFiles").open = true;
    document.body.classList.remove("preview-mode");
  });
  document.getElementById("itemDetails").addEventListener("click", (event) => {
    const expanded = document.body.classList.toggle("show-item-details");
    event.currentTarget.setAttribute("aria-pressed", String(expanded));
  });
  const ids = ["invoiceType", "invoiceDate", "invoiceNo", "invoiceMemo", "buyerName", "buyerTaxId", "buyerAddress", "taxRate", "targetAmount", "targetType", "serviceType", "splitCount", "allocationStyle", "transactionText", "sourcePriceType"];
  const el = (id) => document.getElementById(id);
  let undoRows = null;
  let sourceFacts = [];
  let baseline;
  let lastExport = "";

  function rowsSnapshot() {
    return readRows().map(({ tr, ...row }) => ({ ...row, name: tr.querySelector(".name").value }));
  }
  function snapshot() {
    return { version: 1, fields: Object.fromEntries(ids.map((id) => [id, el(id).value])), rows: rowsSnapshot(), sourceFacts };
  }
  function dirty() { return JSON.stringify(snapshot()) !== baseline; }
  function refresh() {
    el("saveStatus").textContent = dirty() ? "尚未匯出目前修改" : lastExport || "尚未儲存";
    const active = rowsSnapshot().filter((row) => row.unit > 0 && row.qty > 0);
    document.querySelector(".transaction-section").classList.toggle("confirmed", active.length > 0 && active.every((row) => row.priceType !== "pending"));
    renderReview();
  }
  function replaceRows(rows) {
    body.replaceChildren();
    rows.forEach((row) => makeRow(row));
    updateTotals();
  }
  function renderReview() {
    const box = el("sourceReview");
    box.replaceChildren();
    if (!sourceFacts.length) return;
    const list = document.createElement("dl");
    const rows = rowsSnapshot();
    for (const fact of sourceFacts) {
      const term = document.createElement("dt");
      term.textContent = fact.label;
      const detail = document.createElement("dd");
      const current = fact.field ? el(fact.field).value : rows.map((row) => `${row.name} ${row.qty} × ${row.unit}`).join("；");
      detail.textContent = `原文擷取：${fact.value}｜目前：${current || "待填寫"}`;
      list.append(term, detail);
    }
    box.append(list);
  }
  function moneyNumber(value) { return Number(value.replaceAll(",", "")); }
  function parseDescription() {
    const raw = el("transactionText").value.trim();
    if (!raw) { el("sourceStatus").textContent = "請先輸入交易描述。"; return; }
    const name = raw.match(/(?:抬頭|買受人|公司名稱)\s*[:：]\s*([^，,；;\n]+)/);
    const taxId = raw.match(/統(?:一編)?編?(?:號)?\s*[:：]?\s*(\d{8})(?!\d)/);
    const hasUntaxed = /未稅|不含稅/.test(raw);
    const hasTaxed = /(?<!不)含稅/.test(raw.replaceAll("未稅", ""));
    const priceType = hasUntaxed !== hasTaxed ? hasUntaxed ? "untaxed" : "taxed" : "pending";
    const rows = [];
    const unmatched = [];
    for (const original of raw.split(/[；;\n。]/).map((line) => line.trim()).filter(Boolean)) {
      const line = original.replace(/(?:以上|均為|全部)?(?:未稅|不含稅|含稅)[。\s]*$/, "").trim();
      if (!line || /^(?:抬頭|買受人|公司名稱|統編|統一編號)\s*[:：]/.test(line)) continue;
      const match = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:堂|次|式|件|個|小時|份|組)\s*[,，]?\s*每(?:堂|次|式|件|個|小時|份|組)\s*([\d,]+(?:\.\d+)?)\s*元?$/)
        || line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*[×x*]\s*([\d,]+(?:\.\d+)?)\s*元?$/);
      if (match && Number(match[2]) > 0 && moneyNumber(match[3]) >= 0) {
        rows.push({ name: match[1].trim(), qty: Number(match[2]), unit: moneyNumber(match[3]), priceType, taxType: "taxable", adjustable: true });
      } else if (!/^(?:以上|均為|全部)?\s*$/.test(line)) unmatched.push(original);
    }
    if (!name && !taxId && !rows.length) {
      el("sourceStatus").textContent = "尚無可確定的欄位。請用「抬頭：名稱；統編：8碼；品項 4 堂，每堂 3000 元」或手動填寫。原文已保留。";
      return;
    }
    if (rows.length && rowsSnapshot().some((row) => row.name || row.unit > 0) && !window.confirm("整理結果會替換目前品項，是否繼續？可用「復原上次套用」回復品項。")) return;
    window.capturePlanUndo();
    sourceFacts = [];
    if (name) { el("buyerName").value = name[1].trim(); sourceFacts.push({ field: "buyerName", label: "買受人", value: name[1].trim() }); }
    if (taxId) { el("buyerTaxId").value = taxId[1]; sourceFacts.push({ field: "buyerTaxId", label: "統一編號", value: taxId[1] }); }
    el("sourcePriceType").value = priceType;
    if (rows.length) {
      replaceRows(rows);
      sourceFacts.push({ label: "品項明細", value: rows.map((row) => `${row.name} ${row.qty} × ${row.unit}`).join("；") });
    }
    invalidateSuggestions();
    updateTotals();
    el("sourceStatus").textContent = `已辨識 ${rows.length} 筆品項；${priceType === "pending" ? "含稅／未稅待確認。" : "請核對價格類型與課稅別。"}${unmatched.length ? `尚未套用的內容：${unmatched.join("；")}` : ""}`;
    refresh();
  }
  window.capturePlanUndo = () => {
    undoRows = rowsSnapshot();
    el("undoPlan").disabled = false;
  };
  el("undoPlan").addEventListener("click", () => {
    if (!undoRows) return;
    const previous = undoRows;
    undoRows = null;
    replaceRows(previous);
    el("undoPlan").disabled = true;
    invalidateSuggestions();
    el("planStatus").textContent = "已復原套用前的品項明細。";
    refresh();
  });
  el("parseTransaction").addEventListener("click", parseDescription);
  el("confirmSourcePrice").addEventListener("click", () => {
    const type = el("sourcePriceType").value;
    if (type === "pending") { el("sourceStatus").textContent = "請先選擇含稅或未稅。"; return; }
    window.capturePlanUndo();
    body.querySelectorAll(".priceType").forEach((input) => { input.value = type; });
    updateTotals();
    el("sourceStatus").textContent = `目前全部品項已確認為${type === "taxed" ? "含稅" : "未稅"}單價。`;
  });
  el("saveDraft").addEventListener("click", async () => {
    const data = snapshot();
    const serialized = JSON.stringify(data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const button = el("saveDraft");
    button.disabled = true;
    let url;
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: `invoice-draft-${el("invoiceDate").value || todayValue()}.json`, types: [{ description: "開票草稿", accept: { "application/json": [".json"] } }] });
        const stream = await handle.createWritable();
        await stream.write(blob);
        await stream.close();
        baseline = serialized;
        lastExport = `已儲存 ${new Date().toLocaleTimeString("zh-TW")}`;
        refresh();
      } else {
        url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `invoice-draft-${el("invoiceDate").value || todayValue()}.json`;
        link.click();
        el("saveStatus").textContent = "已送出草稿下載，請確認檔案；尚未驗證儲存完成。";
      }
    } catch (error) {
      el("saveStatus").textContent = error.name === "AbortError" ? "已取消儲存，目前修改尚未儲存。" : "儲存失敗，請重新匯出草稿。";
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 30000);
      button.disabled = false;
    }
  });
  function validateDraft(data) {
    if (!data || data.version !== 1 || !data.fields || !Array.isArray(data.rows) || !data.rows.length || data.rows.length > 100) throw new Error("草稿格式不符");
    const fields = {};
    for (const id of ids) {
      const value = data.fields[id];
      if (typeof value !== "string" || value.length > (id === "transactionText" ? 20000 : 2000)) throw new Error("欄位格式不符");
      if (el(id).tagName === "SELECT" && ![...el(id).options].some((option) => option.value === value)) throw new Error("欄位選項不符");
      fields[id] = value;
    }
    const date = new Date(`${fields.invoiceDate}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.invoiceDate) || !Number.isFinite(date.getTime()) || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` !== fields.invoiceDate || !Number.isFinite(Number(fields.taxRate)) || Number(fields.taxRate) < 0 || Number(fields.taxRate) > 100) throw new Error("日期或稅率不符");
    const rows = data.rows.map((row) => {
      if (!row || typeof row.name !== "string" || row.name.length > 2000 || !["pending", "taxed", "untaxed"].includes(row.priceType) || !["taxable", "zero", "exempt"].includes(row.taxType) || !Number.isFinite(row.qty) || !Number.isFinite(row.unit) || row.qty < 0 || row.unit < 0 || row.qty * row.unit > Number.MAX_SAFE_INTEGER) throw new Error("品項格式不符");
      return { name: row.name, qty: row.qty, unit: row.unit, priceType: row.priceType, taxType: row.taxType, adjustable: row.adjustable !== false };
    });
    const facts = Array.isArray(data.sourceFacts) ? data.sourceFacts.filter((fact) => fact && typeof fact.label === "string" && typeof fact.value === "string" && (!fact.field || ["buyerName", "buyerTaxId"].includes(fact.field))).map((fact) => ({ label: fact.label.slice(0, 100), value: fact.value.slice(0, 20000), ...(fact.field ? { field: fact.field } : {}) })) : [];
    return { fields, rows, facts };
  }
  el("loadDraft").addEventListener("click", () => el("draftFile").click());
  el("draftFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("檔案過大");
      const data = validateDraft(JSON.parse(await file.text()));
      if (dirty() && !window.confirm("目前有未儲存修改，確定載入另一份草稿？")) return;
      state.companyRequestId += 1;
      clearTimeout(state.companyLookupTimer);
      for (const id of ids) el(id).value = data.fields[id];
      sourceFacts = data.facts;
      replaceRows(data.rows);
      undoRows = null;
      el("undoPlan").disabled = true;
      invalidateSuggestions();
      el("sourceStatus").textContent = "已載入草稿，請核對原文與明細。";
      baseline = JSON.stringify(snapshot());
      lastExport = "已載入草稿檔";
      refresh();
    } catch (error) { el("saveStatus").textContent = `載入失敗：${error.message}，原有內容未替換。`; }
    finally { event.target.value = ""; }
  });
  el("newDraft").addEventListener("click", () => {
    if (dirty() && !window.confirm("目前有未儲存修改，確定建立新草稿？")) return;
    state.companyRequestId += 1;
    clearTimeout(state.companyLookupTimer);
    for (const id of ["invoiceNo", "invoiceMemo", "buyerName", "buyerTaxId", "buyerAddress", "targetAmount", "transactionText"]) el(id).value = "";
    el("invoiceDate").value = todayValue();
    el("sourcePriceType").value = "pending";
    sourceFacts = [];
    replaceRows([{}]);
    undoRows = null;
    el("undoPlan").disabled = true;
    invalidateSuggestions();
    el("sourceStatus").textContent = "";
    el("exportStatus").textContent = "";
    hideCompanyResults();
    baseline = JSON.stringify(snapshot());
    lastExport = "";
    refresh();
  });
  baseline = JSON.stringify(snapshot());
  for (const [id, preview] of [["showEditor", false], ["showPreview", true]]) {
    el(id).addEventListener("click", () => {
      document.body.classList.toggle("preview-mode", preview);
      el("showEditor").setAttribute("aria-pressed", String(!preview));
      el("showPreview").setAttribute("aria-pressed", String(preview));
    });
  }
  window.draftWorkflowChanged = refresh;
  document.addEventListener("input", refresh);
  document.addEventListener("change", refresh);
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) { event.preventDefault(); event.returnValue = ""; }
  });
})();
