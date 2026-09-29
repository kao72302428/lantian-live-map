const SHEET_ID = '1OsP6JygCRd5FN4XHZsba8TM6hEU8h96k3cqHTJfr6Sk';
const SHEET_NAME = '案件紀錄';
const NOTIFY_EMAIL = 'kao72302428@gmail.com';
const PHOTO_FOLDER_ID = '1EVW-eWrvDlhsDFR7IFN6KlGOQ7OADnUT';

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
    const photoBase64 = String(p['照片Base64'] || '');
    const photoName = clean_(p['照片檔名']) || '';
    const photoMime = clean_(p['照片格式']) || '';

    if (!type || !name || !phone || !email || !content) {
      return result_(false, '', '缺少必要欄位');
    }

    let photoUrl = '';
    let photoSavedName = '';
    let photoSavedMime = '';
    let photoBlob = null;

    if (photoBase64) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      const effectiveMime = photoMime || 'image/jpeg';
      if (!allowed.includes(effectiveMime)) throw new Error('不支援的照片格式');

      const bytes = Utilities.base64Decode(photoBase64);
      if (bytes.length > 2500000) throw new Error('照片檔案過大，請改用較小圖片');

      const originalName = photoName || 'photo.jpg';
      const safeOriginalName = originalName.replace(/[^0-9A-Za-z._\-\u4e00-\u9fff]/g, '_');
      photoSavedName = caseId + '-' + safeOriginalName;
      photoSavedMime = effectiveMime;
      photoBlob = Utilities.newBlob(bytes, effectiveMime, photoSavedName);

      const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
      const file = folder.createFile(photoBlob.copyBlob());
      photoUrl = file.getUrl();
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
        '智慧藍田 LIVE 一點通｜建言與合作',
        photoUrl,
        photoSavedName,
        photoSavedMime
      ]);
    } finally {
      lock.releaseLock();
    }

    const subject = '【智慧藍田】新案件 ' + caseId + '｜' + type;
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
      '附件照片：' + (photoUrl || '無'),
      '附件檔名：' + (photoSavedName || '無'),
      '附件格式：' + (photoSavedMime || '無'),
      '',
      'Google Sheets 案件紀錄：',
      'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'
    ].join('\n');

    const mailOptions = {
      to: NOTIFY_EMAIL,
      subject: subject,
      body: body,
      replyTo: email,
      name: '智慧藍田 LIVE 一點通'
    };
    if (photoBlob) mailOptions.attachments = [photoBlob];
    MailApp.sendEmail(mailOptions);

    // 使用者收件確認信：案件已成功寫入後才寄送。
    // 若確認信寄送失敗，不影響案件已成功建立的結果，避免使用者重複送件。
    try {
      const receiptSubject = '【智慧藍田】已收到您的留言｜' + caseId;
      const receiptBody = [
        name + ' 您好：',
        '',
        '我們已收到您的留言，後續將依案件內容儘速檢視、處理並回覆。',
        '以下為您本次提交的內容，請留存案件編號供後續查詢。',
        '',
        '案件編號：' + caseId,
        '送出時間：' + submittedAt,
        '留言類型：' + type,
        '',
        '您的留言內容：',
        content,
        '',
        '如後續需要補充資料，可直接回覆本信或透過「智慧藍田 LIVE 一點通」再次聯絡。',
        '',
        '智慧藍田 LIVE 一點通',
        '高雄市工商發展協會',
        '聯絡電話：0933-101-434',
        'Email：' + NOTIFY_EMAIL
      ].join('\n');

      MailApp.sendEmail({
        to: email,
        subject: receiptSubject,
        body: receiptBody,
        replyTo: NOTIFY_EMAIL,
        name: '智慧藍田 LIVE 一點通'
      });
    } catch (receiptErr) {
      console.log('使用者收件確認信寄送失敗：' + String(receiptErr && receiptErr.message ? receiptErr.message : receiptErr));
    }

    return result_(true, caseId, '已送出');
  } catch (err) {
    return result_(false, '', String(err && err.message ? err.message : err));
  }
}

function doGet() {
  return HtmlService.createHtmlOutput('智慧藍田建言與合作表單服務正常');
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
