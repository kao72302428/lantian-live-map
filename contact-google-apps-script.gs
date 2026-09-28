const SHEET_ID = '1OsP6JygCRd5FN4XHZsba8TM6hEU8h96k3cqHTJfr6Sk';
const SHEET_NAME = '案件紀錄';
const NOTIFY_EMAIL = 'kao72302428@gmail.com';

function doPost(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    const now = new Date();
    const tz = 'Asia/Taipei';
    const caseId = 'LT-' + Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 5).toUpperCase();
    const submittedAt = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');

    const type = clean_(p['聯絡類型']);
    const name = clean_(p['姓名']);
    const phone = clean_(p['電話']);
    const email = clean_(p['email']);
    const content = clean_(p['事實內容']);

    if (!type || !name || !phone || !email || !content) {
      return result_(false, '', '缺少必要欄位');
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('找不到工作表：' + SHEET_NAME);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow([
        caseId,
        submittedAt,
        type,
        name,
        phone,
        email,
        content,
        '未處理',
        '',
        submittedAt,
        '智慧藍田 LIVE 一點通｜聯絡我們'
      ]);
    } finally {
      lock.releaseLock();
    }

    const subject = '【智慧藍田】新聯絡案件 ' + caseId + '｜' + type;
    const body = [
      '案件編號：' + caseId,
      '送出時間：' + submittedAt,
      '聯絡類型：' + type,
      '姓名：' + name,
      '電話：' + phone,
      'Email：' + email,
      '',
      '事實內容：',
      content,
      '',
      'Google Sheets 案件紀錄：',
      'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'
    ].join('\n');

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: subject,
      body: body,
      replyTo: email,
      name: '智慧藍田 LIVE 一點通'
    });

    return result_(true, caseId, '已送出');
  } catch (err) {
    return result_(false, '', String(err && err.message ? err.message : err));
  }
}

function doGet() {
  return HtmlService.createHtmlOutput('智慧藍田聯絡表單服務正常');
}

function result_(ok, id, message) {
  const payload = JSON.stringify({ ok: ok, id: id, message: message });
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>' +
    'parent.postMessage(' + payload + ', "*");' +
    '</script><div style="font-family:sans-serif;padding:16px">' +
    (ok ? '資料已送出' : '送出失敗') +
    '</div>'
  );
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, 10000);
}
