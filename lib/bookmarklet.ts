// 高島屋のページの上で動く「自動入力おてつだい」のプログラム（ブックマークレット）を作ります。
//
// しくみ：
// - アプリから別のサイト（高島屋）の入力欄に直接書き込むことは、ブラウザの安全のルールでできません。
// - そこで、このプログラムをブックマーク（お気に入り）に登録しておき、
//   高島屋のページを開いた状態でそのブックマークを押すと、高島屋のページの中でこのプログラムが動きます。
// - 保存した情報は、このプログラムの中に書き込まれます。
// - パスワードは入れません。パスワードの欄では、iPhoneやパソコンが作る「強力なパスワード」を使うよう案内します。

import { digitsOnly, type Profile } from "./profile";

type HelperData = {
  email: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  zip: string;
  pref: string;
  city: string;
  street: string;
  building: string;
  tel: string;
  telParts: string[];
  gender: string;
  by: string;
  bm: string;
  bd: string;
  mailmag: string;
  api: string; // アプリのアドレス（AIに聞くときの問い合わせ先）
  code: string; // 合言葉
};

function toHelperData(p: Profile, opts: { api: string; code: string }): HelperData {
  const telParts = p.phone
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .split(/[^0-9]+/)
    .filter(Boolean);
  return {
    email: p.email.trim(),
    lastName: p.lastName.trim(),
    firstName: p.firstName.trim(),
    lastNameKana: p.lastNameKana.trim(),
    firstNameKana: p.firstNameKana.trim(),
    zip: digitsOnly(p.postalCode),
    pref: p.prefecture,
    city: p.city.trim(),
    street: p.street.trim(),
    building: p.building.trim(),
    tel: digitsOnly(p.phone),
    telParts: telParts.length === 3 ? telParts : [],
    gender: p.gender,
    by: digitsOnly(p.birthYear),
    bm: digitsOnly(p.birthMonth),
    bd: digitsOnly(p.birthDay),
    mailmag: p.mailmag,
    api: opts.api,
    code: opts.code,
  };
}

// ここから下は高島屋のページの中で動くプログラム本体です。
// （中身はふつうのJavaScriptです。__DATA__ の部分に保存した情報が入ります）
const HELPER_SOURCE = String.raw`(function () {
  var D = __DATA__;
  var OLD = document.getElementById("kaiin-helper-host");
  if (OLD) { OLD.remove(); }
  document.querySelectorAll("[data-kaiin-mark]").forEach(function (e) { e.style.outline = ""; e.removeAttribute("data-kaiin-mark"); });

  var KANA = /(kana|カナ|かな|フリガナ|ふりがな|セイ|メイ|furigana|ruby)/i;

  function txt(e) { return e ? (e.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function short(s) { return s.length > 60 ? "" : s; }

  function hintOf(el) {
    var parts = [el.name, el.id, el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("autocomplete"), el.getAttribute("title")];
    if (el.labels) { for (var i = 0; i < el.labels.length; i++) { parts.push(txt(el.labels[i])); } }
    var lb = el.closest("label"); if (lb) { parts.push(short(txt(lb))); }
    var by = el.getAttribute("aria-labelledby");
    if (by) { by.split(" ").forEach(function (id) { parts.push(txt(document.getElementById(id))); }); }
    var tr = el.closest("tr"); if (tr) { var th = tr.querySelector("th"); if (th) { parts.push(short(txt(th))); } }
    var dd = el.closest("dd"); if (dd && dd.previousElementSibling) { parts.push(short(txt(dd.previousElementSibling))); }
    var fs = el.closest("fieldset"); if (fs) { var lg = fs.querySelector("legend"); if (lg) { parts.push(short(txt(lg))); } }
    var prev = el.previousElementSibling; if (prev && prev.tagName !== "INPUT" && prev.tagName !== "SELECT") { parts.push(short(txt(prev))); }
    var p = el.parentElement;
    for (var k = 0; k < 3 && p; k++) {
      if (p.previousElementSibling) { var t = short(txt(p.previousElementSibling)); if (t) { parts.push(t); break; } }
      p = p.parentElement;
    }
    return parts.filter(Boolean).join(" | ");
  }

  function visible(el) {
    if (el.disabled || el.readOnly) { return false; }
    if (el.type === "hidden") { return false; }
    var r = el.getBoundingClientRect();
    var st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") {
      if (el.type === "radio" || el.type === "checkbox") { return !!el.closest("label") || !!(el.labels && el.labels.length); }
      return false;
    }
    return r.width > 0 || r.height > 0 || el.type === "radio" || el.type === "checkbox";
  }

  var all = Array.prototype.slice.call(document.querySelectorAll("input, select, textarea")).filter(function (el) {
    if (el.closest("#kaiin-helper-host")) { return false; }
    if (/^(submit|button|image|reset|file|search)$/i.test(el.type)) { return false; }
    return visible(el);
  });
  var H = new Map();
  all.forEach(function (el) { H.set(el, hintOf(el)); });
  var used = new Set();
  function textish(el) { return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|email|tel|number|password|date|)$/i.test(el.type)); }
  function find(test, onlyText) {
    return all.filter(function (el) {
      if (used.has(el)) { return false; }
      if (onlyText && !textish(el)) { return false; }
      return test(el, H.get(el) || "");
    });
  }
  function take(list) { list.forEach(function (e) { used.add(e); }); return list; }

  var steps = [];
  function add(label, shown, targets, fill) {
    steps.push({ label: label, shown: shown, targets: targets, fill: fill, value: shown });
  }

  function setVal(el, v) {
    try { el.focus({ preventScroll: true }); } catch (e) {}
    var proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, "value");
    if (d && d.set) { d.set.call(el, v); } else { el.value = v; }
    ["input", "change", "keyup"].forEach(function (n) { el.dispatchEvent(new Event(n, { bubbles: true })); });
    try { el.blur(); } catch (e) {}
  }
  function norm(s) { return String(s || "").replace(/[\s　]/g, "").replace(/[年月日]$/, "").replace(/^0+(?=\d)/, ""); }
  function setSelect(el, v) {
    var want = norm(v);
    var opts = Array.prototype.slice.call(el.options);
    var o = opts.find(function (o) { return norm(o.text) === want || norm(o.value) === want; });
    if (!o) { return false; }
    setVal(el, o.value);
    return true;
  }
  function labelOfChoice(el) {
    var t = "";
    if (el.labels && el.labels.length) { t = txt(el.labels[0]); }
    if (!t) { var lb = el.closest("label"); if (lb) { t = txt(lb); } }
    if (!t && el.nextSibling) { t = (el.nextSibling.textContent || "").trim(); }
    return t + " " + (el.value || "");
  }
  function click(el) { if (!el.checked) { el.click(); } return true; }

  function fillText(list, v) { list.forEach(function (el) { if (el.tagName === "SELECT") { setSelect(el, v); } else { setVal(el, v); } }); return list.length > 0; }

  if (D.email) {
    var em = take(find(function (el, h) { return el.type === "email" || (/(mail|メール)/i.test(h) && !/(magazine|mag|news|ニュース|マガジン|配信|希望)/i.test(h)); }, true));
    add("メールアドレス", D.email, em, function () { return fillText(em, D.email); });
  }

  /* パスワードは自動で入れず、iPhone・パソコンの「強力なパスワード」を使ってもらいます */
  var pw = take(find(function (el) { return el.type === "password"; }, true));
  steps.push({ label: "パスワード", shown: "", value: "", targets: pw, manual: true });

  var BAD = /(mail|user|nick|ニック|建物|building|会社|company|部署|カード|card|宛名|ログイン|login|検索|search|room|号室)/i;
  var kanaEls = take(find(function (el, h) { return KANA.test(h) && !BAD.test(h) && !/(住所|address|市区|番地)/i.test(h); }, true));
  var nameEls = take(find(function (el, h) { return /(name|氏名|名前|姓|shimei|sei|mei)/i.test(h) && !BAD.test(h) && !/(住所|address|市区|番地)/i.test(h); }, true));

  if (D.lastName) {
    if (nameEls.length >= 2) {
      add("お名前（姓）", D.lastName, [nameEls[0]], function () { return fillText([nameEls[0]], D.lastName); });
      add("お名前（名）", D.firstName, [nameEls[1]], function () { return fillText([nameEls[1]], D.firstName); });
    } else {
      var full = D.lastName + "　" + D.firstName;
      add("お名前", full, nameEls, function () { return fillText(nameEls, full); });
    }
  }
  if (D.lastNameKana) {
    if (kanaEls.length >= 2) {
      add("フリガナ（セイ）", D.lastNameKana, [kanaEls[0]], function () { return fillText([kanaEls[0]], D.lastNameKana); });
      add("フリガナ（メイ）", D.firstNameKana, [kanaEls[1]], function () { return fillText([kanaEls[1]], D.firstNameKana); });
    } else {
      var fullK = D.lastNameKana + "　" + D.firstNameKana;
      add("フリガナ", fullK, kanaEls, function () { return fillText(kanaEls, fullK); });
    }
  }

  var zipMain = null;
  if (D.zip) {
    var zipEls = take(find(function (el, h) { return /(zip|post|郵便|yubin|〒)/i.test(h); }, true));
    zipMain = zipEls.length === 1 ? zipEls[0] : null;
    var zipShown = D.zip.slice(0, 3) + "-" + D.zip.slice(3);
    add("郵便番号", zipShown, zipEls, function () {
      if (zipEls.length >= 2) { setVal(zipEls[0], D.zip.slice(0, 3)); setVal(zipEls[1], D.zip.slice(3)); return true; }
      return fillText(zipEls, D.zip);
    });
  }

  /* ===== 住所 ===== */
  /* 見えていない欄も含めて探します（高島屋の「番地」などは、町村を選んだあとで表示されるため） */
  function anyEl(test) {
    return Array.prototype.slice.call(document.querySelectorAll("input, select")).filter(function (el) {
      if (el.closest("#kaiin-helper-host") || el.type === "hidden" || used.has(el)) { return false; }
      return test(el, H.get(el) || hintOf(el));
    });
  }
  var NOT_ABROAD = function (el) { return !/abroad|overseas|海外/i.test((el.name || "") + (el.id || "")); };
  var citySel = anyEl(function (el, h) { return el.tagName === "SELECT" && /(市区|city)/i.test(h) && !/(町村|town)/i.test(h); })[0];
  var townSel = citySel ? anyEl(function (el, h) { return el.tagName === "SELECT" && /(町村|town)/i.test(h); })[0] : null;

  if (citySel && townSel && D.city) {
    /* 郵便番号から「都道府県」「市区」「町村」「丁目」の選択肢が出る形（高島屋の会員情報入力ページ） */
    var prefSel = anyEl(function (el, h) { return el.tagName === "SELECT" && /(pref|都道府県)/i.test(h); })[0];
    var townInp = anyEl(function (el, h) { return textish(el) && NOT_ABROAD(el) && /(町村|town)/i.test(h); })[0];
    var chomeSel = anyEl(function (el, h) { return el.tagName === "SELECT" && /(丁目|street)/i.test(h); })[0];
    var blockInp = anyEl(function (el, h) { return textish(el) && NOT_ABROAD(el) && /(番地|block)/i.test(h); })[0];
    var bldInp = anyEl(function (el, h) { return textish(el) && NOT_ABROAD(el) && /(building|建物|マンション|ビル)/i.test(h); })[0];
    take([prefSel, citySel, townSel, townInp, chomeSel, blockInp, bldInp].filter(Boolean));
    var addrShown = D.pref + D.city + D.street + (D.building ? "　" + D.building : "");
    add("住所", addrShown, [prefSel || citySel], fillSelectAddress);
  } else {
    if (D.pref) {
      var prefEls = take(find(function (el, h) {
        if (el.tagName === "SELECT") { return Array.prototype.some.call(el.options, function (o) { return o.text.indexOf("北海道") >= 0; }); }
        return textish(el) && /(pref|都道府県|todofuken)/i.test(h);
      }, false)).slice(0, 1);
      add("都道府県", D.pref, prefEls, function () { return fillText(prefEls, D.pref); });
    }

    var ADDR_NOT = /(zip|post|郵便|pref|都道府県|mail|tel|phone|電話)/i;
    var cityEls = take(find(function (el, h) { return /(city|市区町村|市区郡|address1|addr1|住所1|住所１)/i.test(h) && !ADDR_NOT.test(h) && !KANA.test(h); }, true)).slice(0, 1);
    var streetEls = take(find(function (el, h) { return /(street|番地|町名|address2|addr2|住所2|住所２|town)/i.test(h) && !ADDR_NOT.test(h) && !KANA.test(h); }, true)).slice(0, 1);
    var bldEls = take(find(function (el, h) { return /(building|建物|マンション|ビル|address3|addr3|住所3|住所３|apart|号室)/i.test(h) && !ADDR_NOT.test(h) && !KANA.test(h); }, true)).slice(0, 1);
    var genericAddr = find(function (el, h) { return /(住所|address|addr)/i.test(h) && !ADDR_NOT.test(h) && !KANA.test(h); }, true);
    if (!cityEls.length && genericAddr.length) { cityEls = take([genericAddr.shift()]); }
    if (!streetEls.length && genericAddr.length) { streetEls = take([genericAddr.shift()]); }
    if (!bldEls.length && genericAddr.length) { bldEls = take([genericAddr.shift()]); }
    if (D.city) {
      if (!streetEls.length && cityEls.length) {
        var cs = D.city + D.street;
        add("住所（市区町村・番地）", cs, cityEls, function () { return fillText(cityEls, cs); });
      } else {
        add("住所（市区町村）", D.city, cityEls, function () { return fillText(cityEls, D.city); });
        if (D.street) { add("住所（番地）", D.street, streetEls, function () { return fillText(streetEls, D.street); }); }
      }
    }
    if (D.building) { add("建物名・部屋番号", D.building, bldEls, function () { return fillText(bldEls, D.building); }); }
  }

  if (D.tel) {
    var telEls = take(find(function (el, h) { return (el.type === "tel" || /(tel|phone|電話|携帯|mobile)/i.test(h)) && !/(fax|ファクス|ファックス)/i.test(h); }, true));
    var telShown = D.telParts.length === 3 ? D.telParts.join("-") : D.tel;
    var telTargets = telEls.length >= 3 && D.telParts.length === 3 ? telEls.slice(0, 3) : telEls.slice(0, 1);
    add("電話番号", telShown, telTargets, function () {
      if (telTargets.length === 3) { telTargets.forEach(function (el, i) { setVal(el, D.telParts[i]); }); return true; }
      return fillText(telTargets, D.tel);
    });
  }

  if (D.gender) {
    var gWant = D.gender === "male" ? /男/ : D.gender === "female" ? /女/ : /(回答しない|無回答|その他|選択しない)/;
    var gShown = D.gender === "male" ? "男性" : D.gender === "female" ? "女性" : "回答しない";
    var gEls = find(function (el, h) {
      if (el.type === "radio") { return /(sex|gender|性別|seibetsu)/i.test(h + " " + el.name) || /^\s*(男性|女性)/.test(labelOfChoice(el)); }
      if (el.tagName === "SELECT") { return /(sex|gender|性別|seibetsu)/i.test(h); }
      return false;
    }, false);
    var gTarget = gEls.filter(function (el) { return el.tagName === "SELECT" || gWant.test(labelOfChoice(el)); }).slice(0, 1);
    take(gEls);
    add("性別", gShown, gTarget, function () {
      if (!gTarget.length) { return false; }
      if (gTarget[0].tagName === "SELECT") { return setSelect(gTarget[0], gShown) || setSelect(gTarget[0], gShown.charAt(0)); }
      return click(gTarget[0]);
    });
  }

  if (D.by && D.bm && D.bd) {
    var bShown = D.by + "年" + D.bm + "月" + D.bd + "日";
    var bEls = take(find(function (el, h) { return /(birth|誕生|生年月日|byear|bmonth|bday)/i.test(h); }, false));
    /* 「年」の欄しか見つからないときは、同じ場所にある「月」「日」の選ぶ欄もまとめて使います（高島屋：yearOfBirth / yearOfMonth / yearOfDate） */
    if (bEls.length === 1 && bEls[0].tagName === "SELECT") {
      var box = bEls[0].parentElement;
      for (var up = 0; up < 5 && box && box.querySelectorAll("select").length < 3; up++) { box = box.parentElement; }
      if (box) {
        var sels = Array.prototype.slice.call(box.querySelectorAll("select"));
        var at = sels.indexOf(bEls[0]);
        var three = sels.slice(at, at + 3);
        if (three.length === 3) { bEls = take(three); }
      }
    }
    add("生年月日", bShown, bEls, function () {
      if (!bEls.length) { return false; }
      var pad = function (s) { return ("0" + s).slice(-2); };
      if (bEls.length === 1) {
        var el = bEls[0];
        if (el.type === "date") { setVal(el, D.by + "-" + pad(D.bm) + "-" + pad(D.bd)); }
        else { setVal(el, D.by + pad(D.bm) + pad(D.bd)); }
        return true;
      }
      var vals = [D.by, D.bm, D.bd];
      var ordered = bEls.slice(0, 3);
      ordered.forEach(function (el, i) {
        var nid = ((el.name || "") + " " + (el.id || "")).replace(/birth(day)?/ig, "");
        var after = el.nextSibling ? (el.nextSibling.textContent || "").trim().charAt(0) : "";
        /* 「月」「日」を先に見ます（高島屋の月の欄は yearOfMonth のように year を含むため） */
        var v = /(month|(^|[_\-\s])mm?\b)/i.test(nid) || after === "月" ? D.bm
          : /(day|date|(^|[_\-\s])dd?\b)/i.test(nid) || after === "日" ? D.bd
          : /(year|yyyy|(^|[_\-\s])y\b)/i.test(nid) || after === "年" ? D.by
          : vals[i];
        if (el.tagName === "SELECT") { setSelect(el, v); } else { setVal(el, v); }
      });
      return true;
    });
  }

  if (D.mailmag) {
    var mShown = D.mailmag === "yes" ? "受け取る" : "受け取らない";
    var mEls = find(function (el, h) {
      if (el.type !== "radio" && el.type !== "checkbox") { return false; }
      return /(mail_?mag|magazine|メールマガジン|メルマガ|news|ニュース|配信)/i.test(h + " " + labelOfChoice(el));
    }, false);
    take(mEls);
    add("メールマガジン", mShown, mEls, function () {
      if (!mEls.length) { return false; }
      var radios = mEls.filter(function (el) { return el.type === "radio"; });
      if (radios.length) {
        var no = /(しない|いいえ|不要|受け取らない|ない)/;
        var t = radios.find(function (el) { var l = labelOfChoice(el); return D.mailmag === "yes" ? !no.test(l) : no.test(l); });
        if (t) { return click(t); }
        return false;
      }
      mEls.forEach(function (el) { if (el.checked !== (D.mailmag === "yes")) { el.click(); } });
      return true;
    });
  }

  var found = steps.filter(function (s) { return s.targets.length > 0; });
  var missing = steps.filter(function (s) { return s.targets.length === 0; });
  found.sort(function (a, b) {
    var p = a.targets[0].compareDocumentPosition(b.targets[0]);
    return p & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : p & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
  });

  /* ===== 画面に出す案内 ===== */
  var host = document.createElement("div");
  host.id = "kaiin-helper-host";
  host.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;";
  var root = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  var css = "*{box-sizing:border-box;font-family:'Hiragino Sans','Noto Sans JP',sans-serif}" +
    ".p{background:#fff;border-top:5px solid #b5541b;box-shadow:0 -6px 24px rgba(0,0,0,.25);padding:14px 16px 18px;color:#1f1a14;max-height:62vh;overflow:auto}" +
    ".hd{display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:700;color:#8f3f10;margin-bottom:6px}" +
    ".x{font-size:16px;min-height:40px;padding:4px 12px;border:2px solid #d9cfc2;background:#fff;border-radius:10px;font-weight:700;color:#1f1a14}" +
    ".t{font-size:24px;font-weight:700;line-height:1.4;margin:2px 0 6px}" +
    ".v{font-size:20px;background:#fbeadd;border-radius:10px;padding:8px 12px;margin-bottom:10px;word-break:break-all}" +
    ".m{font-size:17px;line-height:1.6;margin:0 0 10px}" +
    ".b{display:block;width:100%;min-height:60px;font-size:22px;font-weight:700;border-radius:14px;border:3px solid #b5541b;background:#b5541b;color:#fff;margin-bottom:10px}" +
    ".r{display:flex;gap:10px}.r .s{flex:1}" +
    ".s{min-height:50px;font-size:18px;font-weight:700;border-radius:12px;border:2px solid #b5541b;background:#fff;color:#8f3f10;padding:4px 10px}" +
    ".ok{color:#1f7a3a;font-weight:700;font-size:18px;margin-bottom:8px}" +
    ".mi{border:2px solid #d9cfc2;border-radius:12px;padding:10px 12px;margin-bottom:10px}" +
    ".mi .t{font-size:19px}" +
    ".p.top{border-top:0;border-bottom:5px solid #b5541b;box-shadow:0 6px 24px rgba(0,0,0,.25);padding-top:max(12px,env(safe-area-inset-top))}" +
    ".warn{color:#9a2a10;font-weight:700;font-size:17px;margin-bottom:8px}" +
    ".hb{display:flex;gap:6px;flex-shrink:0}.hd{gap:8px}.hd>span:first-child{min-width:0}.x{white-space:nowrap}" +
    ".r2{display:flex;gap:10px;margin-bottom:10px;align-items:stretch}.r2 .b{flex:1;width:auto;margin:0}" +
    ".b2{flex:1;min-height:60px;font-size:19px;font-weight:700;line-height:1.3;border-radius:14px;border:3px solid #b5541b;background:#fbeadd;color:#8f3f10;padding:6px 8px}" +
    ".b2 .sm,.b .sm{display:block;font-size:14px;font-weight:700}" +
    ".r2 .home{min-height:96px;font-size:22px}" +
    ".lnk{display:block;text-align:center;font-size:17px;font-weight:700;color:#8f3f10;padding:10px 0 2px}" +
    ".in{display:block;width:100%;font-size:18px;min-height:52px;border:2px solid #d9cfc2;border-radius:10px;padding:8px 10px;margin-bottom:10px;color:#1f1a14;background:#fff}" +
    ".ans{font-size:19px;line-height:1.7;white-space:pre-wrap;background:#f7f3ee;border:2px solid #d9cfc2;border-radius:12px;padding:10px 12px;margin-bottom:10px}" +
    ".me{font-size:16px;color:#5c5247;margin-bottom:6px}" +
    ".q{display:block;width:100%;text-align:left;margin-bottom:8px}";
  var panel = document.createElement("div");
  panel.className = "p";
  var style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);
  root.appendChild(panel);
  /* 案内の中を押したことを高島屋のページに伝えません（開いているメニューが閉じてしまうのを防ぎます） */
  ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "focusin", "keydown"].forEach(function (t) {
    host.addEventListener(t, function (e) { e.stopPropagation(); });
  });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clearMarks() { document.querySelectorAll("[data-kaiin-mark]").forEach(function (e) { e.style.outline = ""; e.style.outlineOffset = ""; e.removeAttribute("data-kaiin-mark"); }); }
  function mark(list) {
    clearMarks();
    list.forEach(function (el) {
      var t = (el.type === "radio" || el.type === "checkbox") ? (el.closest("label") || el) : el;
      t.setAttribute("data-kaiin-mark", "1");
      t.style.outline = "5px solid #e8711f";
      t.style.outlineOffset = "3px";
    });
    if (list[0]) {
      var tgt = list[0].closest("label") || list[0];
      var r = tgt.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.2, behavior: "smooth" });
    }
  }
  function close() { clearMarks(); host.remove(); document.removeEventListener("focusin", onPick, true); }
  function copy(text) {
    try { navigator.clipboard.writeText(text); return; } catch (e) {}
    var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }

  var i = 0;
  var lastOk = "";
  var picking = null;

  function onPick(ev) {
    if (!picking) { return; }
    var el = ev.target;
    if (!el || host.contains(el) || !(el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) { return; }
    var s = picking; picking = null;
    document.removeEventListener("focusin", onPick, true);
    setTimeout(function () {
      if (el.tagName === "SELECT") { setSelect(el, s.value); } else { setVal(el, s.value); }
      s.picked = true;
      mark([el]);
      renderDone();
    }, 50);
  }

  /* 案内を画面の上か下に置きます（パスワードのときは、キーボードの上に出る提案を隠さないよう上に置きます） */
  function placeTop(top) {
    host.style.top = top ? "0" : "auto";
    host.style.bottom = top ? "auto" : "0";
    panel.className = top ? "p top" : "p";
  }
  function pwFilled(s) { return s.targets.length > 0 && s.targets.every(function (e) { return !!e.value; }); }

  function renderPwBar(warn) {
    placeTop(true);
    panel.innerHTML =
      '<div class="hd"><span>パスワード</span><span class="hb"><button class="x" data-a="home">ホーム</button><button class="x" data-a="close">閉じる</button></span></div>' +
      (warn ? '<div class="warn">まだパスワードが入っていないようです。</div>' : "") +
      '<div class="m"><b>①</b> オレンジの枠の欄をタップ<br><b>②</b> 「<b>強力なパスワードを使用</b>」（Android・パソコンは「パスワードの候補」）を選ぶ</div>' +
      '<div class="r"><button class="s" data-a="pwdone">入ったので次へ</button><button class="s" data-a="skip">とばす</button></div>';
  }


  /* ===== 住所の選択肢を、出てくるのを待ってから選ぶ処理 ===== */
  function N(s) {
    return String(s || "").replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[－ー‐−–—―]/g, "-").replace(/[\s　]/g, "");
  }
  function toZen(s) { return String(s || "").replace(/[!-~]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0xfee0); }).replace(/ /g, "　"); }
  function kanjiNum(t) {
    var map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    if (t === "十") { return 10; }
    var m = t.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/);
    if (m) { return (m[1] ? map[m[1]] : 1) * 10 + (m[2] ? map[m[2]] : 0); }
    return map[t] || NaN;
  }
  function chomeNum(t) { t = N(t).replace(/丁目$/, ""); return /^\d+$/.test(t) ? Number(t) : kanjiNum(t); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(fn, ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function loop() {
        var v = null;
        try { v = fn(); } catch (e) { v = null; }
        if (v || Date.now() - t0 > ms) { resolve(v); } else { setTimeout(loop, 200); }
      })();
    });
  }
  /* 条件に合う選択肢のうち、文字がいちばん長いものを選びます */
  function pickOpt(sel, test) {
    var best = null;
    Array.prototype.forEach.call(sel.options, function (o) {
      var t = N(o.text);
      if (!o.value || !t || !test(t)) { return; }
      if (!best || t.length > N(best.text).length) { best = o; }
    });
    return best;
  }
  function choose(sel, o) { if (sel.value !== o.value) { setVal(sel, o.value); } }
  function fillSelectAddress() {
    return (async function () {
      var full = N(D.city + D.street);
      var chosen = []; /* 選んだもの（あとで、消えていないか確かめます） */
      function pickAndRemember(sel, o) { choose(sel, o); chosen.push({ sel: sel, value: o.value }); }
      /* 郵便番号が入っていなければ入れます（高島屋の画面が選択肢を用意します） */
      if (zipMain && N(zipMain.value) !== D.zip) { setVal(zipMain, D.zip); }
      if (prefSel) {
        var po = await waitFor(function () { return pickOpt(prefSel, function (t) { return t === N(D.pref); }); }, 6000);
        if (po) { pickAndRemember(prefSel, po); }
      }
      var co = await waitFor(function () { return pickOpt(citySel, function (t) { return full.indexOf(t) === 0; }); }, 6000);
      if (!co) { return false; }
      pickAndRemember(citySel, co);
      var rest = full.slice(N(co.text).length);
      var ok = true;
      var to = await waitFor(function () { return pickOpt(townSel, function (t) { return t !== "その他地域" && rest.indexOf(t) === 0; }); }, 6000);
      if (to) {
        pickAndRemember(townSel, to);
        rest = rest.slice(N(to.text).length);
      } else {
        /* 町村が一覧にないときは「その他地域」を選び、町村を文字で入れます */
        var other = pickOpt(townSel, function (t) { return t === "その他地域"; });
        var m = rest.match(/^([^\d-]+)(.*)$/);
        if (other && townInp && m) {
          choose(townSel, other);
          await sleep(800);
          setVal(townInp, toZen(m[1]));
          rest = m[2];
        } else { ok = false; }
      }
      var cm = rest.match(/^(\d+)(?:丁目|-)?(.*)$/);
      if (cm && chomeSel) {
        var so = await waitFor(function () { return pickOpt(chomeSel, function (t) { return chomeNum(t) === Number(cm[1]); }); }, 6000);
        if (so) { pickAndRemember(chomeSel, so); rest = cm[2]; }
      }
      /* 丁目を選んだあと、画面が番地の欄を用意するのを少し待ちます */
      await sleep(800);
      rest = rest.replace(/^-+/, "");
      var blockVal = toZen(rest), bldVal = toZen(D.building);
      if (blockInp && rest) { setVal(blockInp, blockVal); }
      if (bldInp && D.building) { setVal(bldInp, bldVal); }
      /* 高島屋の画面は、あとから一覧を読み直して選択を消すことがあるので、消えていたら選び直します（最大3回） */
      for (var round = 0; round < 3; round++) {
        await sleep(1000);
        var fixed = false;
        for (var c = 0; c < chosen.length; c++) {
          var it = chosen[c];
          if (it.sel.value === it.value) { continue; }
          var back = await waitFor(function () { return Array.prototype.find.call(it.sel.options, function (o) { return o.value === it.value; }); }, 4000);
          if (back) { setVal(it.sel, it.value); fixed = true; await sleep(800); }
        }
        if (blockInp && rest && blockInp.value !== blockVal) { setVal(blockInp, blockVal); fixed = true; }
        if (bldInp && D.building && bldInp.value !== bldVal) { setVal(bldInp, bldVal); fixed = true; }
        if (!fixed) { break; }
      }
      return ok && chosen.every(function (it) { return it.sel.value === it.value; });
    })();
  }
  /* 入力の処理を実行します（住所のように時間がかかるものも、終わるまで待ちます） */
  function runFill(st) {
    return new Promise(function (resolve) {
      try { Promise.resolve(st.fill()).then(function (v) { resolve(!!v); }, function () { resolve(false); }); }
      catch (e) { resolve(false); }
    });
  }
  function renderBusy(what) {
    clearMarks();
    panel.innerHTML = '<div class="hd"><span>入力おてつだい</span></div><div class="t">' + esc(what) + 'を入力しています…</div>' +
      '<div class="m">住所は、高島屋の画面に選択肢が出るのを待ってから選びます。少しお待ちください。</div>';
  }

  /* まだ入れていない次のステップの番号 */
  function nextOpen(from) { while (from < found.length && found[from].done) { from++; } return from; }
  /* まとめて入れられる残りの項目の数（パスワードはのぞく） */
  function remainingAuto(from) { return found.slice(from).filter(function (s) { return !s.manual && !s.done; }).length; }
  function bulkButton(from, manual) {
    var n = remainingAuto(from);
    if (n < (manual ? 1 : 2)) { return ""; }
    return '<button class="b2" data-a="all">' + (manual ? "パスワード以外を<br>" : "") + "まとめて入力" +
      '<span class="sm">（残り' + n + "項目）</span></button>";
  }
  /* 「入力する」と「まとめて入力」を横一列に並べます */
  function actionRow(mainBtn, bulk) {
    return bulk ? '<div class="r2">' + mainBtn + bulk + "</div>" : mainBtn;
  }

  function render() {
    placeTop(false);
    if (i >= found.length) { renderDone(); return; }
    var s = found[i];
    mark(s.targets);
    if (s.manual) {
      panel.innerHTML =
        '<div class="hd"><span>入力おてつだい　ステップ ' + (i + 1) + " / " + found.length + '</span><span class="hb"><button class="x" data-a="home">ホーム</button><button class="x" data-a="close">閉じる</button></span></div>' +
        (lastOk ? '<div class="ok">✓ ' + esc(lastOk) + " を入れました</div>" : "") +
        '<div class="t">次は「パスワード」です</div>' +
        '<div class="m">パスワードは、iPhone（またはAndroid・パソコン）に作ってもらいます。作ったパスワードは自動で覚えてくれるので、メモしなくても大丈夫です。</div>' +
        '<div class="m">下のボタンを押したあと、オレンジの枠の欄をタップして、出てきた「<b>強力なパスワードを使用</b>」を選んでください。</div>' +
        actionRow('<button class="b" data-a="pwgo">パスワードの欄へ進む</button>', bulkButton(i, true)) +
        '<div class="r"><button class="s" data-a="prev"' + (i === 0 ? " disabled" : "") + '>前へ</button><button class="s" data-a="skip">とばす</button></div>';
      return;
    }
    panel.innerHTML =
      '<div class="hd"><span>入力おてつだい　ステップ ' + (i + 1) + " / " + found.length + '</span><span class="hb"><button class="x" data-a="home">ホーム</button><button class="x" data-a="close">閉じる</button></span></div>' +
      (lastOk ? '<div class="ok">✓ ' + esc(lastOk) + " を入れました</div>" : "") +
      '<div class="t">次は「' + esc(s.label) + "」です</div>" +
      '<div class="m">オレンジの枠の欄に、この内容を入れます。</div>' +
      '<div class="v">' + esc(s.shown) + "</div>" +
      actionRow('<button class="b" data-a="fill">入力する</button>', bulkButton(i, false)) +
      '<div class="r"><button class="s" data-a="prev"' + (i === 0 ? " disabled" : "") + '>前へ</button><button class="s" data-a="skip">とばす</button></div>';
  }

  function renderDone() {
    placeTop(false);
    clearMarks();
    var miss = missing.concat(found.filter(function (s) { return s.failed; }));
    var html = '<div class="hd"><span>入力おてつだい</span><span class="hb"><button class="x" data-a="home">ホーム</button><button class="x" data-a="close">閉じる</button></span></div>';
    if (found.length === 0 && miss.length === steps.length) {
      html += '<div class="t">このページには、入れる欄が見つかりませんでした</div><div class="m">高島屋の「会員登録」の入力ページを開いてから、もう一度ブックマークを押してください。</div>' +
        '<div class="m">どこを押せばいいか分からないときは、AIに聞いてみましょう。</div>' +
        '<button class="b" data-a="ai">AIに聞く</button>';
    } else {
      html += '<div class="t">✓ このページの入力が終わりました</div>' +
        '<div class="m">入った内容を目で確かめてから、ページの下にある「次へ」「確認」などのボタンを押してください。会員規約などの同意のチェックは、ご自分で確かめてください。</div>';
    }
    var rest = miss.filter(function (s) { return !s.picked; });
    /* メールアドレスだけのページなどでは、ほかの項目は出さないようにします */
    if (rest.length && found.length >= 3) {
      html += '<div class="m"><b>自動で入れられなかった項目</b>（この画面にない場合は気にしなくて大丈夫です）</div>';
      rest.forEach(function (s, k) {
        if (s.manual) {
          html += '<div class="mi"><div class="t">パスワード</div><div class="m">パスワードの欄をタップすると、iPhoneやパソコンが「強力なパスワード」を作ってくれます。</div></div>';
          return;
        }
        html += '<div class="mi"><div class="t">' + esc(s.label) + '</div><div class="v">' + esc(s.value) + "</div>" +
          '<div class="r"><button class="s" data-a="pick" data-k="' + k + '">欄をタップして入れる</button><button class="s" data-a="copy" data-k="' + k + '">コピー</button></div></div>';
      });
    }
    html += '<div class="r"><button class="s" data-a="restart">最初からやり直す</button><button class="s" data-a="home">ホームへ戻る</button></div>';
    panel.innerHTML = html;
    panel._rest = rest;
  }


  /* ===== AIに聞く（ページの作りだけを送り、入力欄の中身は送りません） ===== */
  var PROTECT = ["高島屋おてつだい", "高島屋", "タカシマヤ", "たかしまや", "Takashimaya", "takashimaya"];
  var PV = [D.lastName, D.firstName, D.lastNameKana, D.firstNameKana, D.lastName + D.firstName, D.lastName + " " + D.firstName,
    D.lastName + "　" + D.firstName, D.city, D.street, D.building, D.email, D.tel, D.zip,
    D.telParts.join("-"), D.zip ? D.zip.slice(0, 3) + "-" + D.zip.slice(3) : ""]
    .filter(function (v) { return v && v.length >= 2; })
    .sort(function (a, b) { return b.length - a.length; });
  function redactText(s) {
    var out = String(s || "");
    PROTECT.forEach(function (w, k) { out = out.split(w).join("\u0000" + k + "\u0000"); });
    PV.forEach(function (v) { out = out.split(v).join("［個人情報］"); });
    out = out.replace(/\u0000(\d+)\u0000/g, function (_, n) { return PROTECT[Number(n)]; });
    return out
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "［メールアドレス］")
      .replace(/〒?\s?\d{3}[-－ー]\d{4}(?!\d)/g, "［郵便番号］")
      .replace(/(^|[^\d])0\d{1,4}[-－ー(（]?\d{1,4}[-－ー)）]?\d{3,4}(?!\d)/g, "$1［電話番号］");
  }
  /* 画面に本当に見えているか（閉じたメニューの中＝見えない、も含めて判定します） */
  function shown(el) {
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) { return false; }
    if (el.checkVisibility) { return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); }
    if (getComputedStyle(el).visibility !== "visible") { return false; }
    for (var a = el; a; a = a.parentElement) {
      var st = getComputedStyle(a);
      if (st.display === "none" || st.opacity === "0") { return false; }
    }
    return true;
  }
  function labelText(el) {
    var t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) { t = el.getAttribute("aria-label") || el.getAttribute("title") || ""; }
    if (!t) { var im = el.querySelector && el.querySelector("img[alt]"); if (im) { t = im.getAttribute("alt"); } }
    if (!t && el.tagName === "INPUT" && /^(submit|button)$/i.test(el.type)) { t = el.value; }
    return t.slice(0, 60);
  }
  var KEYWORD = /(会員|登録|ログイン|メニュー|マイページ|新規|次へ|確認|送信|同意)/;
  function collectOutline() {
    document.querySelectorAll("[data-kaiin-ai]").forEach(function (e) { e.removeAttribute("data-kaiin-ai"); });
    var items = [], hiddenCount = 0, n = 0, seen = {};
    var els = document.querySelectorAll("a, button, [role=button], summary, h1, h2, h3, input, select, textarea");
    for (var k = 0; k < els.length && items.length < 160; k++) {
      var el = els[k];
      if (el.closest("#kaiin-helper-host")) { continue; }
      var kind = "", text = "";
      var tag = el.tagName;
      if (tag === "A") { kind = "link"; text = labelText(el); }
      else if (tag === "BUTTON" || tag === "SUMMARY" || el.getAttribute("role") === "button" || (tag === "INPUT" && /^(submit|button)$/i.test(el.type))) { kind = "button"; text = labelText(el); }
      else if (/^H[1-3]$/.test(tag)) { kind = "heading"; text = labelText(el); }
      else if (tag === "INPUT" && /^(radio|checkbox)$/i.test(el.type)) { kind = "choice"; text = labelOfChoice(el).replace(/\s+/g, " ").trim().slice(0, 60); }
      else if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        if (el.type === "hidden") { continue; }
        kind = "field";
        /* 入力欄は「何の欄か」だけ。中身（value）は送りません */
        var rowTh = el.closest("tr") && el.closest("tr").querySelector("th");
        var dt = el.closest("dd") && el.closest("dd").previousElementSibling;
        text = ((el.labels && el.labels[0] && txt(el.labels[0])) || (rowTh && txt(rowTh)) || (dt && txt(dt)) ||
          el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.name || "").slice(0, 60);
      }
      text = redactText(text).trim();
      if (!kind || !text) { continue; }
      var hidden = !shown(el);
      if (hidden) {
        if (!KEYWORD.test(text) || hiddenCount >= 30) { continue; }
        hiddenCount++;
      }
      /* 同じ種類・同じ文字の部品は1つにまとめます（見えているものを優先） */
      var key = kind + "|" + text + "|" + (hidden ? 1 : 0);
      if (seen[key]) { continue; }
      seen[key] = true;
      n++;
      el.setAttribute("data-kaiin-ai", String(n));
      items.push({ n: n, k: kind, t: text, h: hidden });
    }
    return { title: redactText(document.title).slice(0, 100), path: location.pathname, items: items };
  }
  function device() {
    var ua = navigator.userAgent;
    return /iPhone|iPad|iPod/.test(ua) ? "iphone" : /Android/.test(ua) ? "android" : "pc";
  }
  var ai = { msgs: [], busy: false, err: "", target: null };
  function canAi() { return D.api && (/^https:/.test(D.api) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(D.api)); }
  function showTarget() {
    if (ai.target === null) { return; }
    var el = document.querySelector('[data-kaiin-ai="' + ai.target + '"]');
    if (el) { mark([el]); }
  }
  function renderAi() {
    placeTop(false);
    var last = null;
    for (var k = ai.msgs.length - 1; k >= 0; k--) { if (ai.msgs[k].role === "model") { last = ai.msgs[k]; break; } }
    var lastQ = null;
    for (var q = ai.msgs.length - 1; q >= 0; q--) { if (ai.msgs[q].role === "user") { lastQ = ai.msgs[q]; break; } }
    var html = '<div class="hd"><span>AIに聞く</span><span class="hb">' +
      '<button class="x" data-a="home">ホーム</button>' +
      '<button class="x" data-a="close">閉じる</button></span></div>';
    if (!canAi()) {
      html += '<div class="warn">この案内からAIを使うには、アプリを「https://」で始まるアドレスで開いて、ブックマークを登録し直してください。</div>';
      panel.innerHTML = html; return;
    }
    if (ai.busy) {
      html += (lastQ ? '<div class="me">あなた：' + esc(lastQ.text) + "</div>" : "") + '<div class="ans">考えています…</div>';
      panel.innerHTML = html; return;
    }
    if (last) {
      html += (lastQ ? '<div class="me">あなた：' + esc(lastQ.text) + "</div>" : "") + '<div class="ans">' + esc(last.text) + "</div>";
      if (ai.target !== null) { html += '<button class="s q" data-a="aisee">オレンジの枠の所をもう一度見る</button>'; }
    } else {
      html += '<div class="m">このページのボタンや見出しの文字だけをAIに送ります。入力した名前や住所などは送りません。</div>';
    }
    if (ai.err) { html += '<div class="warn">' + esc(ai.err) + "</div>"; }
    if (!last) {
      ["次に何をすればいいですか？", "新規会員登録の画面へ行きたいです", "この画面で、どこを押せばいいですか？"].forEach(function (t) {
        html += '<button class="s q" data-a="aiq" data-q="' + esc(t) + '">' + esc(t) + "</button>";
      });
    }
    html += '<input class="in" id="kq" placeholder="' + (last ? "続けて聞く" : "聞きたいことを書く") + '" enterkeyhint="send">' +
      '<button class="b" data-a="aisend">送る</button>';
    panel.innerHTML = html;
    var inp = panel.querySelector("#kq");
    if (inp) { inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); ask(inp.value); } }); }
  }
  function ask(q) {
    q = redactText(String(q || "").trim());
    if (!q || ai.busy) { return; }
    ai.msgs.push({ role: "user", text: q });
    ai.busy = true; ai.err = ""; ai.target = null;
    clearMarks();
    renderAi();
    var ctrl = window.AbortController ? new AbortController() : null;
    var slow = setTimeout(function () {
      var a = panel.querySelector(".ans");
      if (ai.busy && a) { a.textContent = "考えています…（少し時間がかかっています。もう少しお待ちください）"; }
    }, 10000);
    var giveUp = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, 45000);
    fetch(D.api + "/api/assistant", {
      signal: ctrl ? ctrl.signal : undefined,
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": D.code || "" },
      body: JSON.stringify({ messages: ai.msgs.slice(-10), device: device(), step: null, page: collectOutline() })
    }).then(function (res) {
      return res.json().then(function (j) { return { status: res.status, j: j }; });
    }).then(function (r) {
      clearTimeout(slow); clearTimeout(giveUp);
      ai.busy = false;
      if (r.status === 401) { ai.msgs.pop(); ai.err = "合言葉が合いません。アプリで合言葉を入れてから、ブックマークを登録し直してください。"; renderAi(); return; }
      if (r.status !== 200 || !r.j.text) { ai.msgs.pop(); ai.err = (r.j && r.j.error) || "AIから返事をもらえませんでした。"; renderAi(); return; }
      ai.msgs.push({ role: "model", text: r.j.text });
      ai.target = typeof r.j.target === "number" ? r.j.target : null;
      renderAi();
      showTarget();
    }).catch(function () {
      clearTimeout(slow); clearTimeout(giveUp);
      ai.busy = false; ai.msgs.pop();
      ai.err = "AIから返事がありませんでした。電波の状態を確かめて、もう一度送ってください。";
      renderAi();
    });
  }


  /* ===== ホーム：「自動入力」と「AIに聞く」を選びます ===== */
  function renderHome() {
    placeTop(false);
    clearMarks();
    ai.target = null;
    var autoSub = found.length ? "このページの " + found.length + " 項目" : "入れる欄がないページです";
    panel.innerHTML =
      '<div class="hd"><span>高島屋おてつだい</span><span class="hb"><button class="x" data-a="close">閉じる</button></span></div>' +
      '<div class="t">何をしますか？</div>' +
      '<div class="r2">' +
      '<button class="b home" data-a="auto">自動入力<span class="sm">' + esc(autoSub) + "</span></button>" +
      '<button class="b2 home" data-a="ai">AIに聞く<span class="sm">押す場所を教えます</span></button>' +
      "</div>" +
      (D.api ? '<a class="lnk" href="' + esc(D.api) + '/" target="_blank" rel="noopener">アプリのホームを開く</a>' : "");
  }

  panel.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) { return; }
    var a = b.getAttribute("data-a");
    if (a === "close") { close(); return; }
    if (a === "ai") { renderAi(); return; }
    if (a === "home") { picking = null; document.removeEventListener("focusin", onPick, true); renderHome(); return; }
    if (a === "auto") { if (found.length && i < found.length) { render(); } else { renderDone(); } return; }
    if (a === "aiq") { ask(b.getAttribute("data-q")); return; }
    if (a === "aisend") { var inp = panel.querySelector("#kq"); ask(inp ? inp.value : ""); return; }
    if (a === "aisee") { showTarget(); return; }
    if (a === "fill") {
      var s = found[i];
      renderBusy("「" + s.label + "」");
      runFill(s).then(function (ok) {
        if (!ok) { s.failed = true; lastOk = ""; } else { s.done = true; s.failed = false; lastOk = s.label; }
        i = nextOpen(i + 1); render();
      });
      return;
    }
    if (a === "all") {
      /* パスワード以外の残りを、まとめて入れます */
      var count = 0;
      var todo = found.filter(function (st, j) { return j >= i && !st.manual && !st.done; });
      renderBusy("まとめて");
      todo.reduce(function (prev, st) {
        return prev.then(function () {
          return runFill(st).then(function (good) {
            if (good) { st.done = true; st.failed = false; count++; } else { st.failed = true; }
          });
        });
      }, Promise.resolve()).then(function () {
        lastOk = count + "項目";
        /* パスワードがまだなら、パスワードの案内に進みます */
        var pwAt = found.findIndex(function (st) { return st.manual && !st.done && !pwFilled(st); });
        i = pwAt >= 0 ? pwAt : found.length;
        render();
      });
      return;
    }
    if (a === "pwgo") {
      var t = found[i].targets[0];
      var rr = t.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rr.top - window.innerHeight * 0.45, behavior: "smooth" });
      renderPwBar(false);
      return;
    }
    if (a === "pwdone") {
      if (!pwFilled(found[i]) && !found[i].warned) { found[i].warned = true; renderPwBar(true); return; }
      lastOk = pwFilled(found[i]) ? "パスワード" : "";
      if (pwFilled(found[i])) { found[i].done = true; }
      i = nextOpen(i + 1); render(); return;
    }
    if (a === "skip") { lastOk = ""; i = nextOpen(i + 1); render(); return; }
    if (a === "prev") { lastOk = ""; i = Math.max(0, i - 1); render(); return; }
    if (a === "restart") { lastOk = ""; i = 0; found.forEach(function (s) { s.failed = false; s.done = false; s.warned = false; }); render(); return; }
    var k = Number(b.getAttribute("data-k"));
    var item = panel._rest && panel._rest[k];
    if (!item) { return; }
    if (a === "copy") { copy(item.value); b.textContent = "コピーしました"; return; }
    if (a === "pick") {
      picking = item;
      document.addEventListener("focusin", onPick, true);
      panel.innerHTML = '<div class="hd"><span>入力おてつだい</span><span class="hb"><button class="x" data-a="home">ホーム</button><button class="x" data-a="close">閉じる</button></span></div>' +
        '<div class="t">「' + esc(item.label) + '」を入れたい欄をタップしてください</div>' +
        '<div class="m">ページの入力欄を1回タップすると、そこに自動で入ります。</div>' +
        '<button class="s" data-a="cancelpick" style="width:100%">やめる</button>';
      return;
    }
    if (a === "cancelpick") { picking = null; document.removeEventListener("focusin", onPick, true); renderDone(); }
  });

  renderHome();
})();`;

// 保存した情報を入れたブックマークレット（「javascript:」で始まる文字列）を作ります
export function buildBookmarklet(p: Profile, opts: { api: string; code: string }): string {
  const data = JSON.stringify(toHelperData(p, opts)).replace(/</g, "\\u003c");
  // 関数で置きかえると、パスワードに「$」などの記号が入っていても正しく入ります
  const code = HELPER_SOURCE.replace("__DATA__", () => data)
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
  // 記号（空白・#・% など）は変換し、日本語はそのまま残して文字数を短くします
  const encoded = Array.from(code)
    .map((ch) => (ch.charCodeAt(0) > 127 ? ch : encodeURIComponent(ch)))
    .join("");
  return "javascript:" + encoded;
}
