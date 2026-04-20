// ============================================================
// Campus Fix-It Reporter — Google Apps Script Backend
// Five Elements International School
// ============================================================

const SPREADSHEET_ID = '1h5yMbciRW4HWzxPM99pGyadKbdPsJnr6VPpcL9tEWq0';
const REPORTS_SHEET = 'Reports';
const USERS_SHEET = 'Users';

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === name.trim().toLowerCase()) return sheets[i];
  }
  return null;
}

function sheetToArray(name) {
  var sheet = getSheet(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return [];
  var h = data[0], rows = [];
  for (var i = 1; i < data.length; i++) { var obj = {}; for (var j = 0; j < h.length; j++) obj[h[j]] = data[i][j]; rows.push(obj); }
  return rows;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'reports';
  var result;
  switch (action) {
    case 'reports': result = sheetToArray(REPORTS_SHEET); break;
    case 'stats': result = getStats(); break;
    default: result = {error:'Unknown'};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'login') return ContentService.createTextOutput(JSON.stringify(login(data.username, data.password))).setMimeType(ContentService.MimeType.JSON);
    if (data.action === 'submit') return ContentService.createTextOutput(JSON.stringify(submitReport(data))).setMimeType(ContentService.MimeType.JSON);
    var auth = login(data.auth ? data.auth.username : '', data.auth ? data.auth.password : '');
    if (!auth.success || auth.role !== 'admin') return ContentService.createTextOutput(JSON.stringify({success:false,message:'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
    var result;
    switch (data.action) {
      case 'updateStatus': result = updateStatus(data); break;
      case 'deleteReport': result = deleteReport(data); break;
      case 'setupData': setupData(); result = {success:true}; break;
      default: result = {error:'Unknown'};
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success:false,error:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function submitReport(data) {
  var sheet = getSheet(REPORTS_SHEET);
  if (!sheet) return {success:false, message:'Sheet not found'};
  var id = 'FX-' + Date.now().toString(36).toUpperCase();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
  sheet.appendRow([id, now, data.name||'', data.category||'', data.location||'', data.urgency||'Normal', data.description||'', 'Reported', '']);
  return {success:true, id:id};
}

function updateStatus(data) {
  var sheet = getSheet(REPORTS_SHEET);
  var all = sheet.getDataRange().getDisplayValues();
  var h = all[0];
  var statusCol = h.indexOf('Status'), notesCol = h.indexOf('AdminNotes');
  for (var i = 1; i < all.length; i++) {
    if (all[i][0] === data.id) {
      if (data.status) sheet.getRange(i+1, statusCol+1).setValue(data.status);
      if (data.adminNotes !== undefined) sheet.getRange(i+1, notesCol+1).setValue(data.adminNotes);
      return {success:true};
    }
  }
  return {success:false, message:'Not found'};
}

function deleteReport(data) {
  var sheet = getSheet(REPORTS_SHEET);
  var all = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < all.length; i++) {
    if (all[i][0] === data.id) { sheet.deleteRow(i+1); return {success:true}; }
  }
  return {success:false, message:'Not found'};
}

function getStats() {
  var all = sheetToArray(REPORTS_SHEET);
  var total=all.length, reported=0, inProgress=0, fixed=0;
  var catCount={}, urgCount={};
  for (var i = 0; i < all.length; i++) {
    var s=all[i].Status||'Reported';
    if(s==='Reported')reported++; else if(s==='In Progress')inProgress++; else if(s==='Fixed')fixed++;
    var c=all[i].Category||'Other'; catCount[c]=(catCount[c]||0)+1;
    var u=all[i].Urgency||'Normal'; urgCount[u]=(urgCount[u]||0)+1;
  }
  return {total:total, reported:reported, inProgress:inProgress, fixed:fixed, categories:catCount, urgencies:urgCount};
}

function login(username, password) {
  var sheet = getSheet(USERS_SHEET);
  if (!sheet) return {success:false, message:'Users sheet not found'};
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim()===String(username).trim() && String(data[i][1]).trim()===String(password).trim())
      return {success:true, role:String(data[i][2]).trim(), displayName:String(data[i][3]).trim(), username:String(data[i][0]).trim()};
  }
  return {success:false, message:'Invalid credentials'};
}

function setupData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var us = ss.getSheetByName(USERS_SHEET)||ss.insertSheet(USERS_SHEET); us.clear();
  us.appendRow(['Username','Password','Role','DisplayName']);
  us.appendRow(['admin','admin123','admin','Administrator']);
  us.appendRow(['shyam','teach123','admin','Ms. Shyam']);

  var rs = ss.getSheetByName(REPORTS_SHEET)||ss.insertSheet(REPORTS_SHEET); rs.clear();
  rs.appendRow(['ID','Date','ReportedBy','Category','Location','Urgency','Description','Status','AdminNotes']);
  Logger.log('Setup complete');
}
