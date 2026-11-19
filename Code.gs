// ============================================================
// РЕСПУБЛИКА МИНИ СТАДИОНЛАР ПЛАТФОРМАСИ
// Google Apps Script Backend API
// ============================================================

// Google Sheets ID — деплойдан кейин ўзингизни Sheets ID ни қўйинг
var SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';

// Telegram Bot Token (стадион эгаларига хабар юбориш учун)
var TELEGRAM_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN') || '';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  return {
    stadiums: ss.getSheetByName('Stadiums') || createSheet(ss, 'Stadiums'),
    bookings: ss.getSheetByName('Bookings') || createSheet(ss, 'Bookings'),
    users:    ss.getSheetByName('Users')    || createSheet(ss, 'Users'),
    chat:     ss.getSheetByName('Chat')     || createSheet(ss, 'Chat')
  };
}

function createSheet(ss, name) {
  var sh = ss.insertSheet(name);
  var headers = {
    'Stadiums': ['id','name','owner_name','owner_phone','telegram_id','lat','lng','region','address','working_hours','capacity','price_per_hour','description','confirmed','created_at'],
    'Bookings': ['id','stadium_id','user_phone','user_name','booking_date','start_time','end_time','team1','team2','booking_type','status','score1','score2','notes','created_at'],
    'Users':    ['id','full_name','phone','telegram_username','telegram_id','region','created_at'],
    'Chat':     ['id','stadium_id','user_name','user_phone','message','created_at']
  };
  if (headers[name]) {
    sh.appendRow(headers[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify({ok: true, data: data}))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService.createTextOutput(JSON.stringify({ok: false, error: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0];
  return rows.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function newId() {
  return Utilities.getUuid().split('-')[0];
}

function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function sendTelegram(chatId, text) {
  if (!TELEGRAM_TOKEN || !chatId) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  } catch(e) {}
}

// ============================================================
// MAIN ENTRY POINTS
// ============================================================

function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var cb = params.callback || '';

  var result;
  try {
    switch(action) {
      case 'get_stadiums':     result = getStadiums(params); break;
      case 'get_stadiums_near': result = getStadiumsNear(params); break;
      case 'get_slots':        result = getSlots(params); break;
      case 'get_bookings':     result = getBookings(params); break;
      case 'my_bookings':      result = myBookings(params); break;
      case 'get_chat':         result = getChat(params); break;
      case 'stadium_detail':   result = stadiumDetail(params); break;
      case 'now_playing':      result = nowPlaying(params); break;
      // POST actionlarni ham GET orqali qabul qilamiz (CORS bypass)
      case 'register_stadium': result = registerStadium(params); break;
      case 'register_user':    result = registerUser(params); break;
      case 'book_slot':        result = bookSlot(params); break;
      case 'confirm_booking':  result = confirmBooking(params); break;
      case 'reject_booking':   result = rejectBooking(params); break;
      case 'cancel_booking':   result = cancelBooking(params); break;
      case 'set_score':        result = setScore(params); break;
      case 'send_chat':        result = sendChat(params); break;
      case 'owner_login':      result = ownerLogin(params); break;
      case 'owner_bookings':   result = ownerBookings(params); break;
      case 'confirm_stadium':  result = confirmStadiumAdmin(params); break;
      default: result = err('Noma\'lum action: ' + action);
    }
  } catch(ex) {
    result = err(ex.message);
  }

  // JSONP qo'llab-quvvatlash
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + result.getContent() + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return result;
}

function doPost(e) {
  var params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch(ex) {
    params = e.parameter || {};
  }

  // ── Telegram Webhook ──────────────────────────────────────────
  // Telegram update obyektida "update_id" bo'ladi
  if (params.update_id !== undefined) {
    return handleTelegramUpdate(params);
  }

  var action = params.action || '';

  try {
    switch(action) {
      case 'register_stadium':  return registerStadium(params);
      case 'register_user':     return registerUser(params);
      case 'book_slot':         return bookSlot(params);
      case 'confirm_booking':   return confirmBooking(params);
      case 'reject_booking':    return rejectBooking(params);
      case 'cancel_booking':    return cancelBooking(params);
      case 'set_score':         return setScore(params);
      case 'send_chat':         return sendChat(params);
      case 'update_stadium':    return updateStadium(params);
      case 'confirm_stadium':   return confirmStadiumAdmin(params);
      default: return err('Noma\'lum action: ' + action);
    }
  } catch(ex) {
    return err(ex.message);
  }
}

// ============================================================
// TELEGRAM BOT SESSION (PropertiesService orqali saqlash)
// ============================================================

function getTgSession(chatId) {
  var raw = PropertiesService.getUserProperties().getProperty('tg_' + chatId);
  try { return raw ? JSON.parse(raw) : {}; } catch(e) { return {}; }
}

function setTgSession(chatId, data) {
  PropertiesService.getUserProperties().setProperty('tg_' + chatId, JSON.stringify(data));
}

function clearTgSession(chatId) {
  PropertiesService.getUserProperties().deleteProperty('tg_' + chatId);
}

// ============================================================
// TELEGRAM BOT WEBHOOK HANDLER
// ============================================================

function handleTelegramUpdate(update) {
  try {
    // Callback query (inline tugmalar)
    if (update.callback_query) {
      return handleCallbackQuery(update.callback_query);
    }

    var msg = update.message;
    if (!msg) return ok({ handled: false });

    var chatId    = msg.chat.id;
    var text      = (msg.text || '').trim();
    var firstName = msg.chat.first_name || msg.chat.username || 'Foydalanuvchi';
    var session   = getTgSession(chatId);

    // ── BUYRUQLAR ─────────────────────────────────────────────
    if (text === '/start' || text.indexOf('/start ') === 0) {
      clearTgSession(chatId);
      sendTelegram(chatId,
        '⚽ <b>MiniStadion.uz botiga xush kelibsiz!</b>\n\n' +
        'Salom, ' + firstName + '!\n\n' +
        '🏟 Stadion band qilish: /book\n' +
        '📋 Buyurtmalarim: /mybookings\n' +
        '🆔 Telegram ID: /id\n' +
        '❓ Yordam: /help\n\n' +
        '🌐 Sayt: https://farhod89.github.io/ministadion/'
      );
      return ok({ handled: true });
    }

    if (text === '/id') {
      sendTelegram(chatId,
        '🆔 Sizning Telegram ID: <code>' + chatId + '</code>\n\n' +
        'Stadion ro\'yxatdan o\'tkazishda shu ID ni kiriting.'
      );
      return ok({ handled: true });
    }

    if (text === '/help' || text === '/yordam') {
      sendTelegram(chatId,
        '📌 <b>Buyruqlar:</b>\n\n' +
        '/book — Stadion band qilish\n' +
        '/mybookings — Buyurtmalarim\n' +
        '/cancel — Jarayonni bekor qilish\n' +
        '/id — Telegram ID\n' +
        '/help — Yordam\n\n' +
        '🌐 https://farhod89.github.io/ministadion/'
      );
      return ok({ handled: true });
    }

    if (text === '/cancel') {
      clearTgSession(chatId);
      sendTelegram(chatId, '❌ Bekor qilindi. Boshidan boshlash uchun /book');
      return ok({ handled: true });
    }

    // ── STADION BAND QILISH JARAYONI ──────────────────────────
    if (text === '/book') {
      clearTgSession(chatId);
      return startBookingFlow(chatId);
    }

    if (text === '/mybookings') {
      return showMyBookings(chatId, session);
    }

    // ── SESSION HOLATI ────────────────────────────────────────
    if (session.step) {
      return continueBookingFlow(chatId, text, session);
    }

    // Boshqa xabar
    sendTelegram(chatId,
      'Salom ' + firstName + '! 👋\n\n' +
      'Stadion band qilish: /book\n' +
      'Yordam: /help'
    );
    return ok({ handled: true });

  } catch(ex) {
    return ok({ handled: false, error: ex.message });
  }
}

// ── BOOKING FLOW BOSHLASH ────────────────────────────────────
function startBookingFlow(chatId) {
  // Tasdiqlangan stadionlarni olish
  var sh = getSheets().stadiums;
  var rows = sheetToObjects(sh);
  var confirmed = rows.filter(function(r) { return r.confirmed == 'true' || r.confirmed === true; });

  if (confirmed.length === 0) {
    sendTelegram(chatId, '😔 Hozircha faol stadionlar yo\'q.\n\n🌐 https://farhod89.github.io/ministadion/');
    return ok({ handled: true });
  }

  // Inline keyboard bilan stadionlar ro'yxati
  var keyboard = confirmed.slice(0, 10).map(function(s) {
    return [{ text: '🏟 ' + s.name + ' (' + (s.region || '') + ')', callback_data: 'stadium_' + s.id }];
  });

  sendTelegramKeyboard(chatId,
    '🏟 <b>Qaysi stadionni band qilmoqchisiz?</b>\n\nQuyidagi stadionlardan birini tanlang:',
    keyboard
  );
  setTgSession(chatId, { step: 'choose_stadium' });
  return ok({ handled: true });
}

// ── BOOKING FLOW DAVOMI ──────────────────────────────────────
function continueBookingFlow(chatId, text, session) {
  switch(session.step) {

    case 'enter_phone':
      var phone = text.replace(/\D/g, '');
      if (phone.length < 9) {
        sendTelegram(chatId, '❌ Noto\'g\'ri raqam. Qayta kiriting:\nMasalan: +998901234567');
        return ok({ handled: true });
      }
      session.phone = text;
      session.step = 'enter_name';
      setTgSession(chatId, session);
      sendTelegram(chatId, '👤 Ismingizni kiriting (buyurtma uchun):');
      return ok({ handled: true });

    case 'enter_name':
      if (text.length < 2) {
        sendTelegram(chatId, '❌ Ism juda qisqa. Qayta kiriting:');
        return ok({ handled: true });
      }
      session.name = text;
      session.step = 'enter_date';
      setTgSession(chatId, session);

      // Keyingi 7 kun uchun tugmalar
      var today = new Date();
      var dateKeys = [];
      var dayNames = ['Yak','Du','Se','Cho','Pay','Ju','Sha'];
      for (var i = 0; i < 7; i++) {
        var d = new Date(today);
        d.setDate(today.getDate() + i);
        var label = (i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : dayNames[d.getDay()]) +
                    ' ' + d.getDate() + '/' + (d.getMonth()+1);
        var val = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
        dateKeys.push([{ text: label, callback_data: 'date_' + val }]);
      }
      sendTelegramKeyboard(chatId, '📅 <b>Qaysi kunga band qilmoqchisiz?</b>', dateKeys);
      return ok({ handled: true });

    case 'enter_team1':
      session.team1 = text || 'Jamoam';
      session.step = 'enter_team2';
      setTgSession(chatId, session);
      sendTelegram(chatId, '⚽ 2-jamoa nomi (raqib):\n(yo\'q bo\'lsa "0" kiriting)');
      return ok({ handled: true });

    case 'enter_team2':
      session.team2 = (text === '0' ? '' : text);
      session.step = 'confirm';
      setTgSession(chatId, session);

      // Tasdiqlash
      var summary =
        '📋 <b>Buyurtma ma\'lumotlari:</b>\n\n' +
        '🏟 Stadion: ' + session.stadium_name + '\n' +
        '📅 Sana: ' + session.date + '\n' +
        '⏰ Vaqt: ' + session.start_time + ' — ' + session.end_time + '\n' +
        '👤 Ism: ' + session.name + '\n' +
        '📞 Tel: ' + session.phone + '\n' +
        (session.team1 ? '⚽ Jamoa 1: ' + session.team1 + '\n' : '') +
        (session.team2 ? '⚽ Jamoa 2: ' + session.team2 + '\n' : '') +
        '\nTasdiqlaysizmi?';

      sendTelegramKeyboard(chatId, summary, [
        [{ text: '✅ Ha, tasdiqlash', callback_data: 'confirm_book' }],
        [{ text: '❌ Bekor qilish', callback_data: 'cancel_book' }]
      ]);
      return ok({ handled: true });

    default:
      clearTgSession(chatId);
      sendTelegram(chatId, 'Jarayon tugadi. Qayta boshlash: /book');
      return ok({ handled: true });
  }
}

// ── CALLBACK QUERY HANDLER ───────────────────────────────────
function handleCallbackQuery(cq) {
  var chatId  = cq.message.chat.id;
  var data    = cq.data;
  var session = getTgSession(chatId);

  // Callback queryga "javob" (loading ko'rsatkichini o'chirish)
  answerCallbackQuery(cq.id);

  // Stadion tanlandi
  if (data.indexOf('stadium_') === 0) {
    var stadiumId = data.replace('stadium_', '');
    var sh = getSheets().stadiums;
    var rows = sheetToObjects(sh);
    var st = rows.find(function(r) { return r.id === stadiumId; });
    if (!st) {
      sendTelegram(chatId, '❌ Stadion topilmadi. Qayta: /book');
      return ok({ handled: true });
    }
    session.stadium_id   = stadiumId;
    session.stadium_name = st.name;
    session.price        = st.price_per_hour || 0;
    session.step         = 'enter_phone';
    setTgSession(chatId, session);

    sendTelegram(chatId,
      '✅ <b>' + st.name + '</b> tanlandi!\n\n' +
      '📍 ' + (st.address || st.region || '') + '\n' +
      '⏰ Ish vaqti: ' + (st.working_hours || '08:00-21:00') + '\n' +
      '💰 Narx: ' + (st.price_per_hour ? st.price_per_hour + ' so\'m/soat' : 'Kelishiladi') + '\n\n' +
      '📞 Telefon raqamingizni kiriting:\n(Masalan: +998901234567)'
    );
    return ok({ handled: true });
  }

  // Sana tanlandi
  if (data.indexOf('date_') === 0) {
    var date = data.replace('date_', '');
    session.date = date;
    setTgSession(chatId, session);

    // Bo'sh slotlarni ko'rsatish
    var slots = getFreeSlots(session.stadium_id, date);
    if (slots.length === 0) {
      sendTelegram(chatId, '😔 ' + date + ' kuni bo\'sh vaqt yo\'q.\n\nBoshqa kun tanlang: /book');
      clearTgSession(chatId);
      return ok({ handled: true });
    }

    var slotKeys = slots.map(function(s) {
      return [{ text: '⏰ ' + s.start + ' — ' + s.end, callback_data: 'slot_' + s.start + '_' + s.end }];
    });
    session.step = 'choose_slot';
    setTgSession(chatId, session);
    sendTelegramKeyboard(chatId, '⏰ <b>Qaysi vaqtni tanlaysiz?</b>', slotKeys);
    return ok({ handled: true });
  }

  // Vaqt tanlandi
  if (data.indexOf('slot_') === 0) {
    var parts = data.replace('slot_', '').split('_');
    session.start_time = parts[0];
    session.end_time   = parts[1];
    session.step       = 'enter_team1';
    setTgSession(chatId, session);
    sendTelegram(chatId, '⚽ 1-jamoa nomi (sizning jamoangiz):\n(bo\'sh qoldirish uchun "-" yozing)');
    return ok({ handled: true });
  }

  // Tasdiqlash
  if (data === 'confirm_book') {
    if (!session.stadium_id || !session.date || !session.start_time) {
      sendTelegram(chatId, '❌ Ma\'lumotlar to\'liq emas. Qayta: /book');
      clearTgSession(chatId);
      return ok({ handled: true });
    }
    var bookParams = {
      stadium_id:   session.stadium_id,
      user_phone:   session.phone,
      user_name:    session.name,
      booking_date: session.date,
      start_time:   session.start_time,
      end_time:     session.end_time,
      team1:        session.team1 || '',
      team2:        session.team2 || '',
      booking_type: 'friendly'
    };
    var result;
    try {
      result = JSON.parse(bookSlot(bookParams).getContent());
    } catch(ex) {
      result = { ok: false, error: ex.message };
    }

    clearTgSession(chatId);

    if (result.ok) {
      sendTelegram(chatId,
        '🎉 <b>Buyurtma muvaffaqiyatli yuborildi!</b>\n\n' +
        '🏟 ' + session.stadium_name + '\n' +
        '📅 ' + session.date + '  ⏰ ' + session.start_time + ' — ' + session.end_time + '\n' +
        '🆔 Buyurtma ID: <code>' + (result.id || '') + '</code>\n\n' +
        '⏳ Stadion egasi tasdiqlashini kuting.\n' +
        '🌐 Holat: https://farhod89.github.io/ministadion/'
      );
    } else {
      sendTelegram(chatId, '❌ Xatolik: ' + (result.error || 'Noma\'lum xato') + '\n\nQayta: /book');
    }
    return ok({ handled: true });
  }

  // Bekor qilish
  if (data === 'cancel_book') {
    clearTgSession(chatId);
    sendTelegram(chatId, '❌ Bekor qilindi.\n\nYangi buyurtma: /book');
    return ok({ handled: true });
  }

  return ok({ handled: false });
}

// ── MENING BUYURTMALARIM ─────────────────────────────────────
function showMyBookings(chatId, session) {
  if (!session.phone) {
    session.step = 'mybookings_phone';
    setTgSession(chatId, session);
    sendTelegram(chatId, '📞 Buyurtmalarni ko\'rish uchun telefon raqamingizni kiriting:');
    return ok({ handled: true });
  }
  return showBookingsByPhone(chatId, session.phone);
}

function showBookingsByPhone(chatId, phone) {
  var sh = getSheets().bookings;
  var rows = sheetToObjects(sh);
  var mine = rows.filter(function(r) { return r.user_phone === phone; });

  if (mine.length === 0) {
    sendTelegram(chatId, '📋 Sizda hech qanday buyurtma yo\'q.\n\nBand qilish: /book');
    return ok({ handled: true });
  }

  var text = '📋 <b>Sizning buyurtmalaringiz:</b>\n\n';
  var statusEmoji = { pending: '⏳', confirmed: '✅', rejected: '❌', cancelled: '🚫' };
  mine.slice(-5).reverse().forEach(function(b) {
    text += (statusEmoji[b.status] || '•') + ' <b>' + b.booking_date + '</b> ' + b.start_time + '-' + b.end_time + '\n';
    text += '   Holat: ' + (b.status || 'pending') + '\n\n';
  });
  text += '🌐 https://farhod89.github.io/ministadion/';
  sendTelegram(chatId, text);
  return ok({ handled: true });
}

// ── BO'SH SLOTLAR ─────────────────────────────────────────────
function getFreeSlots(stadiumId, date) {
  var stSh = getSheets().stadiums;
  var stadiums = sheetToObjects(stSh);
  var st = stadiums.find(function(r) { return r.id === stadiumId; });
  if (!st) return [];

  var hours = (st.working_hours || '08:00-21:00').split('-');
  var startH = parseInt(hours[0]) || 8;
  var endH   = parseInt(hours[1]) || 21;

  // Mavjud buyurtmalar
  var bkSh = getSheets().bookings;
  var bookings = sheetToObjects(bkSh).filter(function(b) {
    return b.stadium_id === stadiumId && b.booking_date === date &&
           b.status !== 'rejected' && b.status !== 'cancelled';
  });

  var slots = [];
  for (var h = startH; h < endH; h++) {
    var s = pad2(h) + ':00';
    var e = pad2(h + 1) + ':00';
    var busy = bookings.some(function(b) {
      return b.start_time <= s && b.end_time > s;
    });
    if (!busy) slots.push({ start: s, end: e });
  }
  return slots;
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

// ── TELEGRAM YORDAMCHI FUNKSIYALAR ───────────────────────────
function sendTelegramKeyboard(chatId, text, keyboard) {
  if (!TELEGRAM_TOKEN || !chatId) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      })
    });
  } catch(e) {}
}

function answerCallbackQuery(callbackQueryId) {
  if (!TELEGRAM_TOKEN) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/answerCallbackQuery', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ callback_query_id: callbackQueryId })
    });
  } catch(e) {}
}

// Webhookni o'rnatish funksiyasi — Apps Script'da bir marta qo'lda ishga tushiriladi
function setTelegramWebhook() {
  // MUHIM: /exec URL ishlatiladi, /dev emas (Telegram /dev ga kira olmaydi - 401 xatosi)
  // Quyidagi URL ni o'zingizning haqiqiy deployment URL ingiz bilan almashtiring:
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzbiY3UZ9I8YMRL4AoJUwptl5Ph_xaOe_ngOsTfYwrVJXuSVhewBqEjckLl9tITKXDM/exec';
  var url = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/setWebhook?url=' + encodeURIComponent(APPS_SCRIPT_URL);
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

// Webhook holatini tekshirish
function checkTelegramWebhook() {
  var url = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getWebhookInfo';
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

// ============================================================
// STADIUMS — СТАДИОНЛАР
// ============================================================

function registerStadium(p) {
  if (!p.name || !p.owner_phone || !p.lat || !p.lng) {
    return err('Majburiy maydonlar: name, owner_phone, lat, lng');
  }
  var sh = getSheets().stadiums;
  var rows = sheetToObjects(sh);

  // Takroriy tekshirish
  var exists = rows.find(function(r) { return r.owner_phone === p.owner_phone; });
  if (exists) return err('Bu telefon raqami allaqachon ro\'yxatdan o\'tgan');

  var id = newId();
  var now = new Date().toISOString();
  sh.appendRow([
    id,
    p.name,
    p.owner_name || '',
    p.owner_phone,
    p.telegram_id || '',
    parseFloat(p.lat),
    parseFloat(p.lng),
    p.region || '',
    p.address || '',
    p.working_hours || '08:00-21:00',
    parseInt(p.capacity) || 12,
    parseFloat(p.price_per_hour) || 0,
    p.description || '',
    'pending',  // admin tasdiqlashi kerak
    now
  ]);

  // Admin Telegram ga xabar
  var adminId = PropertiesService.getScriptProperties().getProperty('ADMIN_TELEGRAM_ID');
  if (adminId) {
    sendTelegram(adminId,
      '🏟 Yangi stadion so\'rovi!\n' +
      'Nomi: ' + p.name + '\n' +
      'Egasi: ' + (p.owner_name || '') + '\n' +
      'Tel: ' + p.owner_phone + '\n' +
      'Viloyat: ' + (p.region || '') + '\n' +
      'ID: ' + id
    );
  }

  return ok({ id: id, message: 'Stadion so\'rovi yuborildi. Admin tasdiqlashini kuting.' });
}

function getStadiums(p) {
  var rows = sheetToObjects(getSheets().stadiums);
  var confirmed = rows.filter(function(r) { return r.confirmed === 'confirmed'; });
  if (p.region) {
    confirmed = confirmed.filter(function(r) {
      return r.region === p.region;
    });
  }
  return ok(confirmed);
}

function getStadiumsNear(p) {
  var userLat = parseFloat(p.lat);
  var userLng = parseFloat(p.lng);
  var maxKm   = parseFloat(p.max_km) || 50;

  if (isNaN(userLat) || isNaN(userLng)) return err('lat va lng talab qilinadi');

  var rows = sheetToObjects(getSheets().stadiums);
  var confirmed = rows.filter(function(r) { return r.confirmed === 'confirmed'; });

  var withDist = confirmed.map(function(r) {
    var dist = haversine(userLat, userLng, parseFloat(r.lat), parseFloat(r.lng));
    return Object.assign({}, r, { distance_km: Math.round(dist * 10) / 10 });
  }).filter(function(r) {
    return r.distance_km <= maxKm;
  }).sort(function(a, b) {
    return a.distance_km - b.distance_km;
  });

  return ok(withDist);
}

function stadiumDetail(p) {
  if (!p.stadium_id) return err('stadium_id kerak');
  var rows = sheetToObjects(getSheets().stadiums);
  var s = rows.find(function(r) { return r.id === p.stadium_id; });
  if (!s) return err('Stadion topilmadi');
  return ok(s);
}

function updateStadium(p) {
  if (!p.stadium_id || !p.owner_phone) return err('stadium_id va owner_phone kerak');
  var sh = getSheets().stadiums;
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var idIdx = headers.indexOf('id');
  var ownerIdx = headers.indexOf('owner_phone');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === p.stadium_id && rows[i][ownerIdx] === p.owner_phone) {
      var updatable = ['name','owner_name','address','working_hours','capacity','price_per_hour','description','telegram_id','region'];
      updatable.forEach(function(key) {
        if (p[key] !== undefined) {
          sh.getRange(i+1, headers.indexOf(key)+1).setValue(p[key]);
        }
      });
      return ok({ message: 'Stadion yangilandi' });
    }
  }
  return err('Stadion topilmadi yoki ruxsat yo\'q');
}

function confirmStadiumAdmin(p) {
  var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (p.admin_key !== adminKey) return err('Ruxsat yo\'q');
  if (!p.stadium_id) return err('stadium_id kerak');

  var sh = getSheets().stadiums;
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var idIdx = headers.indexOf('id');
  var confIdx = headers.indexOf('confirmed');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === p.stadium_id) {
      sh.getRange(i+1, confIdx+1).setValue('confirmed');
      var tgId = rows[i][headers.indexOf('telegram_id')];
      var name = rows[i][headers.indexOf('name')];
      sendTelegram(tgId,
        '✅ Sizning "' + name + '" stadioningiz tasdiqlandi!\n' +
        'Endi foydalanuvchilar uni ko\'rishi mumkin.'
      );
      return ok({ message: 'Stadion tasdiqlandi' });
    }
  }
  return err('Stadion topilmadi');
}

// ============================================================
// USERS — ФОЙДАЛАНУВЧИЛАР
// ============================================================

function registerUser(p) {
  if (!p.phone || !p.full_name) return err('phone va full_name kerak');
  var sh = getSheets().users;
  var rows = sheetToObjects(sh);
  var exists = rows.find(function(r) { return r.phone === p.phone; });
  if (exists) return ok({ id: exists.id, message: 'Allaqachon ro\'yxatda' });

  var id = newId();
  sh.appendRow([
    id, p.full_name, p.phone,
    p.telegram_username || '',
    p.telegram_id || '',
    p.region || '',
    new Date().toISOString()
  ]);
  return ok({ id: id, message: 'Ro\'yxatdan o\'tildi' });
}

// ============================================================
// BOOKINGS — БУЮРТМАЛАР
// ============================================================

function getSlots(p) {
  if (!p.stadium_id || !p.date) return err('stadium_id va date kerak');

  var stadiums = sheetToObjects(getSheets().stadiums);
  var stadium = stadiums.find(function(s) { return s.id === p.stadium_id; });
  if (!stadium) return err('Stadion topilmadi');

  var wh = (stadium.working_hours || '08:00-21:00').split('-');
  var openHour  = parseInt(wh[0]) || 8;
  var closeHour = parseInt(wh[1]) || 21;

  var bookings = sheetToObjects(getSheets().bookings);
  var dayBookings = bookings.filter(function(b) {
    return b.stadium_id === p.stadium_id &&
           b.booking_date === p.date &&
           b.status !== 'cancelled' &&
           b.status !== 'rejected';
  });

  var slots = [];
  for (var h = openHour; h < closeHour; h++) {
    var startStr = pad(h) + ':00';
    var endStr   = pad(h+1) + ':00';
    var booking  = dayBookings.find(function(b) {
      return b.start_time === startStr;
    });
    slots.push({
      start: startStr,
      end:   endStr,
      booked: !!booking,
      status: booking ? booking.status : 'free',
      team1:  booking ? booking.team1 : '',
      team2:  booking ? booking.team2 : '',
      type:   booking ? booking.booking_type : ''
    });
  }
  return ok(slots);
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function bookSlot(p) {
  if (!p.stadium_id || !p.user_phone || !p.booking_date || !p.start_time || !p.end_time) {
    return err('Majburiy maydonlar yetishmaydi');
  }

  var sh = getSheets().bookings;
  var rows = sheetToObjects(sh);

  // Conflict tekshirish
  var conflict = rows.find(function(b) {
    return b.stadium_id  === p.stadium_id &&
           b.booking_date === p.booking_date &&
           b.start_time   === p.start_time &&
           b.status !== 'cancelled' &&
           b.status !== 'rejected';
  });
  if (conflict) return err('Bu vaqt allaqachon band');

  var id = newId();
  var now = new Date().toISOString();
  sh.appendRow([
    id,
    p.stadium_id,
    p.user_phone,
    p.user_name || '',
    p.booking_date,
    p.start_time,
    p.end_time,
    p.team1 || '',
    p.team2 || '',
    p.booking_type || 'practice',
    'pending',
    '', '', // score1, score2
    p.notes || '',
    now
  ]);

  // Stadion egasiga Telegram xabar
  var stadiums = sheetToObjects(getSheets().stadiums);
  var stadium = stadiums.find(function(s) { return s.id === p.stadium_id; });
  if (stadium && stadium.telegram_id) {
    sendTelegram(stadium.telegram_id,
      '📅 Yangi buyurtma!\n' +
      'Stadion: ' + stadium.name + '\n' +
      'Sana: ' + p.booking_date + '\n' +
      'Vaqt: ' + p.start_time + '–' + p.end_time + '\n' +
      'Tel: ' + p.user_phone + '\n' +
      (p.team1 ? 'Jamoalar: ' + p.team1 + ' vs ' + (p.team2||'?') + '\n' : '') +
      'Tasdiqlash uchun panelga kiring.'
    );
  }

  return ok({ id: id, message: 'Buyurtma yuborildi' });
}

function confirmBooking(p) {
  return changeBookingStatus(p, 'confirmed', '✅ Buyurtmangiz tasdiqlandi!');
}

function rejectBooking(p) {
  return changeBookingStatus(p, 'rejected', '❌ Buyurtmangiz rad etildi.');
}

function cancelBooking(p) {
  return changeBookingStatus(p, 'cancelled', null, true);
}

function changeBookingStatus(p, newStatus, userMsg, isUser) {
  if (!p.booking_id) return err('booking_id kerak');
  var sh = getSheets().bookings;
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var idIdx     = headers.indexOf('id');
  var statusIdx = headers.indexOf('status');
  var stIdIdx   = headers.indexOf('stadium_id');
  var phoneIdx  = headers.indexOf('user_phone');
  var dateIdx   = headers.indexOf('booking_date');
  var t1Idx     = headers.indexOf('start_time');
  var t2Idx     = headers.indexOf('end_time');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === p.booking_id) {
      if (isUser && rows[i][phoneIdx] !== p.user_phone) return err('Ruxsat yo\'q');
      sh.getRange(i+1, statusIdx+1).setValue(newStatus);

      // Foydalanuvchiga xabar
      if (userMsg) {
        var userPhone = rows[i][phoneIdx];
        var users = sheetToObjects(getSheets().users);
        var user = users.find(function(u) { return u.phone === userPhone; });
        if (user && user.telegram_id) {
          var stadiums = sheetToObjects(getSheets().stadiums);
          var st = stadiums.find(function(s) { return s.id === rows[i][stIdIdx]; });
          sendTelegram(user.telegram_id,
            userMsg + '\n' +
            'Stadion: ' + (st ? st.name : '') + '\n' +
            'Sana: ' + rows[i][dateIdx] + '\n' +
            'Vaqt: ' + rows[i][t1Idx] + '–' + rows[i][t2Idx]
          );
        }
      }
      return ok({ message: 'Status yangilandi: ' + newStatus });
    }
  }
  return err('Buyurtma topilmadi');
}

function setScore(p) {
  if (!p.booking_id || !p.owner_phone) return err('booking_id va owner_phone kerak');
  var sh = getSheets().bookings;
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var idIdx   = headers.indexOf('id');
  var stIdIdx = headers.indexOf('stadium_id');
  var s1Idx   = headers.indexOf('score1');
  var s2Idx   = headers.indexOf('score2');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === p.booking_id) {
      var stadiums = sheetToObjects(getSheets().stadiums);
      var st = stadiums.find(function(s) {
        return s.id === rows[i][stIdIdx] && s.owner_phone === p.owner_phone;
      });
      if (!st) return err('Ruxsat yo\'q');
      sh.getRange(i+1, s1Idx+1).setValue(parseInt(p.score1) || 0);
      sh.getRange(i+1, s2Idx+1).setValue(parseInt(p.score2) || 0);
      return ok({ message: 'Hisob saqlandi' });
    }
  }
  return err('Buyurtma topilmadi');
}

function getBookings(p) {
  if (!p.stadium_id || !p.owner_phone) return err('stadium_id va owner_phone kerak');
  var stadiums = sheetToObjects(getSheets().stadiums);
  var st = stadiums.find(function(s) {
    return s.id === p.stadium_id && s.owner_phone === p.owner_phone;
  });
  if (!st) return err('Ruxsat yo\'q');

  var rows = sheetToObjects(getSheets().bookings);
  var result = rows.filter(function(b) { return b.stadium_id === p.stadium_id; });
  if (p.date) result = result.filter(function(b) { return b.booking_date === p.date; });
  if (p.status) result = result.filter(function(b) { return b.status === p.status; });
  return ok(result);
}

function myBookings(p) {
  if (!p.user_phone) return err('user_phone kerak');
  var rows = sheetToObjects(getSheets().bookings);
  var result = rows.filter(function(b) { return b.user_phone === p.user_phone; });
  // Add stadium name
  var stadiums = sheetToObjects(getSheets().stadiums);
  result = result.map(function(b) {
    var st = stadiums.find(function(s) { return s.id === b.stadium_id; });
    return Object.assign({}, b, { stadium_name: st ? st.name : '' });
  });
  return ok(result);
}

function nowPlaying(p) {
  if (!p.stadium_id) return err('stadium_id kerak');
  var now = new Date();
  var todayStr = Utilities.formatDate(now, 'Asia/Tashkent', 'yyyy-MM-dd');
  var timeStr  = Utilities.formatDate(now, 'Asia/Tashkent', 'HH:mm');

  var rows = sheetToObjects(getSheets().bookings);
  var playing = rows.filter(function(b) {
    return b.stadium_id    === p.stadium_id &&
           b.booking_date  === todayStr &&
           b.status        === 'confirmed' &&
           b.start_time   <= timeStr &&
           b.end_time     >  timeStr;
  });
  var next = rows.filter(function(b) {
    return b.stadium_id    === p.stadium_id &&
           b.booking_date  === todayStr &&
           b.status        === 'confirmed' &&
           b.start_time    >  timeStr;
  }).sort(function(a, b_) { return a.start_time.localeCompare(b_.start_time); });

  return ok({ now_playing: playing, next_booking: next[0] || null });
}

// ============================================================
// CHAT — ЧАТ
// ============================================================

function getChat(p) {
  if (!p.stadium_id) return err('stadium_id kerak');
  var rows = sheetToObjects(getSheets().chat);
  var msgs = rows.filter(function(r) { return r.stadium_id === p.stadium_id; });
  var since = p.since_id || '';
  if (since) {
    var idx = msgs.findIndex(function(m) { return m.id === since; });
    if (idx >= 0) msgs = msgs.slice(idx + 1);
  }
  return ok(msgs.slice(-50));
}

function sendChat(p) {
  if (!p.stadium_id || !p.user_phone || !p.message) {
    return err('stadium_id, user_phone, message kerak');
  }
  var id = newId();
  getSheets().chat.appendRow([
    id,
    p.stadium_id,
    p.user_name || p.user_phone,
    p.user_phone,
    p.message.substring(0, 500),
    new Date().toISOString()
  ]);
  return ok({ id: id });
}

// ============================================================
// SETUP — BOSHLANG'ICH SOZLASH
// ============================================================

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetId = ss.getId();
  var adminKey = 'admin_' + newId();

  // Avval ID va kalitni saqlang
  PropertiesService.getScriptProperties().setProperties({
    'SHEET_ID': sheetId,
    'ADMIN_KEY': adminKey
  });

  // Keyin SHEET_ID bilan listlarni yarating
  var sheets = {
    stadiums: ss.getSheetByName('Stadiums'),
    bookings: ss.getSheetByName('Bookings'),
    users:    ss.getSheetByName('Users'),
    chat:     ss.getSheetByName('Chat')
  };
  if (!sheets.stadiums) createSheet(ss, 'Stadiums');
  if (!sheets.bookings) createSheet(ss, 'Bookings');
  if (!sheets.users)    createSheet(ss, 'Users');
  if (!sheets.chat)     createSheet(ss, 'Chat');

  Logger.log('=== SETUP MUVAFFAQIYATLI ===');
  Logger.log('SHEET_ID: ' + sheetId);
  Logger.log('ADMIN_KEY: ' + adminKey);
  Logger.log('Ushbu kalitni saqlang!');
}
