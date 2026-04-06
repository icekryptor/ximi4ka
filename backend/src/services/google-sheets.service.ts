import { google } from 'googleapis'

function getAuth() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credentialsJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')

  const credentials = JSON.parse(credentialsJson)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export async function appendToSheet(
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
): Promise<number> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })

  return res.data.updates?.updatedRows || 0
}

export async function readSheetColumn(
  spreadsheetId: string,
  sheetName: string,
  column: string
): Promise<string[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${column}:${column}`,
  })

  return (res.data.values || []).flat().map(v => String(v))
}
