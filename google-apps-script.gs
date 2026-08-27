// Google Apps Script — paste in Extensions → Apps Script for your Sheet
// Sheet header row: timestamp | name | email | help | source | page | ua | ip
const SHEET_NAME = 'Leads';
const NOTIFY_EMAIL = ''; // e.g. 'hello@laniconsulting.ng'
function doPost(e){
  try{
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    let d={}; if(e.postData && e.postData.contents){ try{ d=JSON.parse(e.postData.contents);}catch(_){ d=e.parameter; } } else d=e.parameter;
    if(d.website) return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    const row=[d.timestamp||new Date().toISOString(), (d.name||'').trim(), (d.email||'').trim(), (d.help||'').trim(), (d.source||'').trim(), (d.page||'').trim(), (d.ua||d.userAgent||'').trim(), (d.ip||'').trim()];
    if(!row[1]||!row[2]||!row[3]) return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Missing fields'})).setMimeType(ContentService.MimeType.JSON);
    sh.appendRow(row);
    if(NOTIFY_EMAIL) MailApp.sendEmail({to:NOTIFY_EMAIL, subject:'New GRID 01 lead: '+row[1], body:`Name: ${row[1]}\nEmail: ${row[2]}\nHelp: ${row[3]}\nSource: ${row[4]}\nTime: ${row[0]}\nSheet: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`});
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){ return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON); }
}
function doGet(){ return ContentService.createTextOutput(JSON.stringify({ok:true,message:'LANI endpoint live — POST JSON'} )).setMimeType(ContentService.MimeType.JSON); }
