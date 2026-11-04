const assert = require("node:assert/strict");
const { parseTransactionText: parse } = require("./transaction-parser.js");

const actualInput = "週三範例社團\n1200*4=4800\n\n抬頭：範例國小\n統編：12345678\n名稱：115年10月社團鐘點費";
const actual = parse(actualInput, "untaxed");
assert.equal(actual.blocking, false);
assert.equal(actual.fields.buyerName, "範例國小");
assert.equal(actual.fields.buyerTaxId, "12345678");
assert.deepEqual(actual.rows.map(({ name, qty, unit }) => ({ name, qty, unit })), [{ name: "115年10月社團鐘點費", qty: 4, unit: 1200 }]);
assert.deepEqual(actual.contexts, ["週三範例社團"]);
assert.equal(parse(actualInput).priceType, "pending");
assert.equal(parse(actualInput, "taxed").rows[0].priceType, "taxed");

const natural = parse("範例商行，統編12345678，教學4堂，每堂3,000元，教材2,000元，以上未稅。");
assert.equal(natural.blocking, false);
assert.deepEqual(natural.rows.map(({ name, qty, unit }) => ({ name, qty, unit })), [{ name: "教學", qty: 4, unit: 3000 }, { name: "教材", qty: 1, unit: 2000 }]);
assert.equal(natural.priceType, "untaxed");

const labeled = parse("品名：授課費；數量：4；單價：1200；金額：4800；未稅");
assert.equal(labeled.blocking, false);
assert.equal(labeled.rows[0].qty, 4);
assert.equal(parse("抬頭：範例國小 統編：12345678 名稱：社團鐘點費 金額：4800", "untaxed").rows[0].unit, 4800);
assert.equal(parse("名稱：社團鐘點費；總金額：4800元", "untaxed").rows[0].unit, 4800);
assert.equal(parse("名稱：授課費；金額：4800；名稱：教材；金額：2000；總計：6800", "untaxed").rows.length, 2);
assert.equal(parse("名稱：社團鐘點費；1200*4=5000", "untaxed").blocking, true);
assert.equal(parse("名稱：授課費；1200*4=4800；總計：5000", "untaxed").blocking, true);
assert.equal(parse("1200*4=4800").blocking, true);
assert.equal(parse("抬頭：範例國小；統編：12345678").rows.length, 0);
assert.equal(parse("名稱：社團鐘點費；１２００＊４＝４８００；不含稅").rows[0].unit, 1200);
assert.equal(parse("名稱：社團鐘點費；1200*4=4800；含稅又未稅").priceType, "pending");
console.log("Transaction parser regression checks passed.");
