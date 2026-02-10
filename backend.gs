
/**
 * BACKEND PAPELERA LC - GOOGLE APPS SCRIPT v2.3
 * Estrategia Híbrida: GET para leer, POST para escribir.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'SETUP_SHEETS') {
      setup();
      return jsonResponse({ success: true, message: 'Tablas preparadas' });
    }

    if (action === 'SYNC_OUTBOX') {
      let count = 0;
      const items = payload.data || [];
      items.forEach(item => {
        const sheet = SS.getSheetByName(item.tableName);
        if (sheet) {
          if (item.action === 'CREATE' || item.action === 'UPDATE') {
            item.payload.updatedAt = Date.now();
            upsertRecord(sheet, item.payload);
            count++;
          } else if (item.action === 'DELETE') {
            deleteRecord(sheet, item.payload.id);
            count++;
          }
        }
      });
      return jsonResponse({ success: true, message: 'Sincronizados ' + count + ' registros' });
    }
    
    return jsonResponse({ success: false, message: 'Acción desconocida en POST: ' + action });

  } catch(err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    // GET maneja la lectura de datos para evitar problemas de CORS/Redirect en POST
    if (action === 'FETCH_UPDATES') {
      return handleFetchUpdates(e.parameter.table, e.parameter.since);
    }

    return jsonResponse({ status: 'online', version: '2.3' });
  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

function handleFetchUpdates(tableName, since) {
  const sheet = SS.getSheetByName(tableName);
  if (!sheet) return jsonResponse({ success: false, data: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ success: true, data: [] });
  
  const headers = data.shift().map(h => h.toString().toLowerCase().trim());
  const sinceTimestamp = parseInt(since) || 0;
  
  const records = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let value = row[i];
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try { value = JSON.parse(value); } catch(e) {}
      }
      obj[h] = value;
    });
    return obj;
  }).filter(r => (parseInt(r.updatedAt) || 0) > sinceTimestamp);
  
  return jsonResponse({ success: true, data: records });
}

function upsertRecord(sheet, record) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idIndex = headers.indexOf('id');
  
  if (idIndex === -1) return;

  let rowIndex = -1;
  const targetId = record.id || record.ID;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex].toString() === targetId.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const values = data[0].map(h => {
    const key = h.toString().trim();
    const keyLower = key.toLowerCase();
    let val = record[key] || record[keyLower];
    if (val === undefined || val === null) return "";
    return (typeof val === 'object') ? JSON.stringify(val) : val;
  });
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function deleteRecord(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const sheets = ['Productos', 'Clientes', 'Ventas', 'Reparto'];
  const headers = {
    'Productos': ['id', 'name', 'category', 'cost', 'price', 'stock', 'barcode', 'image', 'updatedAt'],
    'Clientes': ['id', 'name', 'phone', 'email', 'address', 'notes', 'updatedAt'],
    'Ventas': ['id', 'customerId', 'customerName', 'items', 'total', 'paymentMethod', 'timestamp', 'status', 'updatedAt'],
    'Reparto': ['id', 'lat', 'lng', 'day', 'timestamp', 'updatedAt', 'note']
  };
  sheets.forEach(s => {
    let sheet = SS.getSheetByName(s);
    if (!sheet) sheet = SS.insertSheet(s);
    sheet.clear();
    sheet.getRange(1, 1, 1, headers[s].length).setValues([headers[s]]);
    sheet.setFrozenRows(1);
    const range = sheet.getRange(1, 1, 1, headers[s].length);
    range.setBackground('#4f46e5').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, headers[s].length);
  });
}
