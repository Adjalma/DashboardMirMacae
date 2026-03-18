#!/usr/bin/env node
/**
 * Converte RelCel_Database.xlsx em dashboard_data.json
 * Usa aba "Celulas (freq)" para dados e "Celulas" para lista canônica de células
 */
import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const excelPath = join(process.cwd(), "data", "RelCel_Database.xlsx");
const outPath = join(root, "client", "public", "dashboard_data.json");

function excelDateToISO(n) {
  if (n == null || isNaN(Number(n))) return null;
  const d = new Date((Number(n) - 25569) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// Normaliza nome para matching (H)/(M) e variações
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(h\)\s*/gi, " (h) ")
    .replace(/\s*\(m\)\s*/gi, " (m) ");
}

const buffer = readFileSync(excelPath);
const wb = XLSX.read(buffer, { type: "array" });

// 1. Lista canônica da aba Celulas (41 células)
const shCel = wb.Sheets["Celulas"];
const rowsCel = XLSX.utils.sheet_to_json(shCel, { header: 1, defval: "" });
const canonicalCells = new Map();
const canonicalList = [];
for (let i = 1; i < rowsCel.length; i++) {
  const c = String(rowsCel[i]?.[0] ?? "").trim();
  const g = String(rowsCel[i]?.[2] ?? "").trim();
  if (c && !canonicalCells.has(c)) {
    canonicalCells.set(c, { Célula: c, Geração: g });
    canonicalList.push({ Célula: c, Geração: g });
  }
}

// 2. Dados da aba Celulas (freq)
const shFreq = wb.Sheets["Celulas (freq)"];
const rowsFreq = XLSX.utils.sheet_to_json(shFreq, { header: 1, defval: 0 });
const headers = rowsFreq[0];
const iGen = 1,
  iCel = 2,
  iTipo = 5;
const dateStart = 6;

const byCellDate = new Map();
const allDates = new Set();
const cellsInFreq = new Set();

for (let col = dateStart; col < headers.length; col++) {
  const d = excelDateToISO(headers[col]);
  if (d) allDates.add(d);
}

for (let i = 1; i < rowsFreq.length; i++) {
  const r = rowsFreq[i];
  const cel = String(r[iCel] ?? "").trim();
  const gen = String(r[iGen] ?? "").trim();
  const tipo = String(r[iTipo] ?? "").trim();
  if (!cel || !gen) continue;
  cellsInFreq.add(cel);

  for (let col = dateStart; col < r.length; col++) {
    const val = Number(r[col]) || 0;
    const dateNum = headers[col];
    if (typeof dateNum !== "number") continue;
    const data = excelDateToISO(dateNum);
    if (!data) continue;

    const key = `${cel}|${data}`;
    if (!byCellDate.has(key)) {
      byCellDate.set(key, {
        Geração: gen,
        Célula: cel,
        Data: data,
        Membros: 0,
        Visitantes: 0,
        Conversão: 0,
      });
    }
    const o = byCellDate.get(key);
    if (tipo === "Membros") o.Membros = val;
    else if (tipo === "Visitantes") o.Visitantes = val;
    else if (tipo === "Conversão") o.Conversão = val;
  }
}

// 3. Mapear freq -> canônico: match exato, norm ou por local (ignora H/M)
function findCanonical(freqName) {
  if (canonicalCells.has(freqName)) return freqName;
  for (const { Célula } of canonicalList) {
    if (norm(Célula) === norm(freqName)) return Célula;
  }
  const local = (s) => String(s).split(/\s*-\s*/).pop().trim().toLowerCase();
  const freqLocal = local(freqName);
  for (const { Célula } of canonicalList) {
    if (local(Célula) === freqLocal) return Célula;
  }
  return null;
}

// 4. Agregar por (célula canônica, data) - SÓ células da aba Celulas
const byCanonDate = new Map();
for (const [, o] of byCellDate) {
  const canon = findCanonical(o.Célula);
  if (!canon) continue;
  const key = `${canon}|${o.Data}`;
  if (!byCanonDate.has(key)) {
    byCanonDate.set(key, {
      Geração: o.Geração,
      Célula: canon,
      Data: o.Data,
      Membros: 0,
      Visitantes: 0,
      Conversão: 0,
    });
  }
  const cur = byCanonDate.get(key);
  cur.Membros += o.Membros;
  cur.Visitantes += o.Visitantes;
  cur.Conversão += o.Conversão;
}

const output = [...byCanonDate.values()].map((o) => ({
  ...o,
  Total_Presentes: o.Membros + o.Visitantes,
  Taxa_Conversao: 0,
}));

// 5. Células da aba Celulas sem dados: zeros em cada data
const datesSorted = [...allDates].sort();
const cellsInOutput = new Set(output.map((x) => x.Célula));
for (const { Célula, Geração } of canonicalList) {
  if (cellsInOutput.has(Célula)) continue;
  for (const data of datesSorted) {
    output.push({
      Geração,
      Célula,
      Data: data,
      Membros: 0,
      Visitantes: 0,
      Conversão: 0,
      Total_Presentes: 0,
      Taxa_Conversao: 0,
    });
  }
  cellsInOutput.add(Célula);
}

// 6. Completar até 41: incluir células do freq que não mapeiam
const needed = 41 - cellsInOutput.size;
if (needed > 0) {
  const unmappedCount = new Map();
  for (const [, o] of byCellDate) {
    if (findCanonical(o.Célula)) continue;
    unmappedCount.set(o.Célula, (unmappedCount.get(o.Célula) || 0) + 1);
  }
  const toAdd = [...unmappedCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, needed)
    .map(([c]) => c);
  for (const fc of toAdd) {
    const gen = [...byCellDate.values()].find((o) => o.Célula === fc)?.Geração || "";
    for (const [, o] of byCellDate) {
      if (o.Célula !== fc) continue;
      output.push({
        Geração: gen,
        Célula: fc,
        Data: o.Data,
        Membros: o.Membros,
        Visitantes: o.Visitantes,
        Conversão: o.Conversão,
        Total_Presentes: o.Membros + o.Visitantes,
        Taxa_Conversao: 0,
      });
    }
    cellsInOutput.add(fc);
  }
}

output.sort((a, b) => {
  const d = a.Data.localeCompare(b.Data);
  return d !== 0 ? d : a.Célula.localeCompare(b.Célula);
});

writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

const uniqueCells = new Set(output.map((x) => x.Célula));
console.log(`✓ dashboard_data.json gerado`);
console.log(`  Registros: ${output.length}`);
console.log(`  Células únicas: ${uniqueCells.size}`);
console.log(`  Datas: ${allDates.size}`);
