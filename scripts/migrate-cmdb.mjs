const required = name => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const csvUrl = process.env.CMDB_CSV_URL?.trim() ||
  'https://docs.google.com/spreadsheets/d/1uWbVwsJ6mgUl9WxJz-zbxMaiCW-dG3DI_9gvKkEca18/export?format=csv&gid=2046046325';

function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(value); value = ''; }
    else if (character === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const number = value => { const parsed = Number(clean(value)); return Number.isFinite(parsed) ? parsed : null; };
const pick = (record, ...names) => {
  for (const name of names) {
    const key = Object.keys(record).find(item => clean(item).toLowerCase() === name.toLowerCase());
    if (key && clean(record[key])) return clean(record[key]);
  }
  return '';
};

const csvResponse = await fetch(csvUrl, { redirect: 'follow' });
if (!csvResponse.ok) throw new Error(`CMDB download failed (${csvResponse.status})`);
const rows = parseCSV(await csvResponse.text());
const headerIndex = rows.findIndex(row => row.some(cell => clean(cell).toUpperCase() === 'COW ID'));
if (headerIndex < 0) throw new Error('CMDB header row containing COW ID was not found');
const headers = rows[headerIndex].map(clean);
const records = rows.slice(headerIndex + 1).map(row => {
  const details = {};
  headers.forEach((header, index) => { if (header) details[header] = clean(row[index]); });
  const id = pick(details, 'COW ID', 'Site');
  return {
    id: id.toUpperCase(),
    lat: number(pick(details, 'Latitude', 'Lat')),
    lon: number(pick(details, 'Longitude', 'Lng', 'Lon')),
    status: pick(details, 'Site Status', 'COW Status', 'Status'),
    region: pick(details, 'Region'),
    district: pick(details, 'District', 'DistrictName'),
    city: pick(details, 'City', 'CityName'),
    details,
    source_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}).filter(record => record.id);

for (let offset = 0; offset < records.length; offset += 100) {
  const response = await fetch(`${supabaseUrl}/rest/v1/assets?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(records.slice(offset, offset + 100))
  });
  if (!response.ok) throw new Error(`Supabase upsert failed (${response.status}): ${await response.text()}`);
}

console.log(`Migrated ${records.length} CMDB assets to Supabase.`);

