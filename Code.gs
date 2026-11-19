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
// TELEGRAM BOT WEBHOOK HANDLER
// ============================================================

function handleTelegramUpdate(update) {
  try {
    var msg = update.message || update.callback_query && update.callback_query.message;
    if (!msg) return ok({ handled: false });

    var chatId = msg.chat.id;
    var text   = (msg.text || '').trim();
    var firstName = (msg.chat.first_name || msg.chat.username || 'Foydalanuvchi');

    // /start buyrug'i
    if (text === '/start' || text.indexOf('/start') === 0) {
      var welcome =
        '⚽ <b>MiniStadion.uz botiga xush kelibsiz!</b>\n\n' +
        'Salom, ' + firstName + '!\n\n' +
        'Bu bot orqali siz:\n' +
        '• 🏟 Stadion egasi bo\'lsangiz — buyurtmalar haqida bildirishnoma olasiz\n' +
        '• 📋 Buyurtmalaringiz holati haqida xabar olasiz\n\n' +
        '🌐 Saytimiz: https://farhod89.github.io/ministadion/\n\n' +
        '<b>Telegram ID ingiz:</b> <code>' + chatId + '</code>\n' +
        'Stadion ro\'yxatdan o\'tkazishda shu ID ni kiriting!';
      sendTelegram(chatId, welcome);
      return ok({ handled: true });
    }

    // /id buyrug'i — foydalanuvchi o'z chat_id sini bilishi uchun
    if (text === '/id') {
      sendTelegram(chatId,
        '🆔 Sizning Telegram ID: <code>' + chatId + '</code>\n\n' +
        'Stadion ro\'yxatdan o\'tkazishda shu ID ni "Telegram ID" maydoniga kiriting.'
      );
      return ok({ handled: true });
    }

    // /help buyrug'i
    if (text === '/help' || text === '/yordam') {
      var helpText =
        '📌 <b>Buyruqlar ro\'yxati:</b>\n\n' +
        '/start — Botni ishga tushirish\n' +
        '/id — Telegram ID ni ko\'rish\n' +
        '/help — Yordam\n\n' +
        '🏟 Stadion ro\'yxatdan o\'tkazish uchun:\n' +
        'https://farhod89.github.io/ministadion/\n\n' +
        '❓ Muammo bo\'lsa, sayt orqali bog\'laning.';
      sendTelegram(chatId, helpText);
      return ok({ handled: true });
    }

    // Boshqa xabar — umumiy javob
    sendTelegram(chatId,
      'Salom ' + firstName + '! 👋\n\n' +
      'Men faqat stadion bildirishnomalari uchun ishlaymen.\n\n' +
      '/help — buyruqlar ro\'yxati\n' +
      '/id — Telegram ID ni ko\'rish\n\n' +
      '🌐 https://farhod89.github.io/ministadion/'
    );
    return ok({ handled: true });

  } catch(ex) {
    return ok({ handled: false, error: ex.message });
  }
}

// Webhookni o'rnatish funksiyasi — Apps Script'da bir marta qo'lda ishga tushiriladi
function setTelegramWebhook() {
  var APPS_SCRIPT_URL = ScriptApp.getService().getUrl();
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
