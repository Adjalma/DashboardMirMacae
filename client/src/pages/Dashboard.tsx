import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, TrendingUp, Zap, Target, BarChart3, Upload, FileDown, LayoutGrid } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";

const STORAGE_KEY = "celulas_dashboard_imported_data";

/** Extrai a geração do nome da célula. Agrupa: Filhos/Filhas de Sião → Sião; Geração de Benjamim → Benjamim. Monte Sião permanece separado. */
function getGeracaoFromCelula(celula: string): string {
  if (!celula?.trim()) return "";
  let base = celula.trim();
  const match = celula.match(/^(.+?)\s*\([MH]\)\s+-/);
  if (match) base = match[1].trim();
  else if (celula.includes(" Adolescentes")) base = celula.replace(" Adolescentes", "").trim();
  if (/^Filh[oa]s de Sião$/i.test(base)) return "Sião";
  if (/^Monte Sião$/i.test(base)) return "Monte Sião";
  if (/Benjamim/i.test(base)) return "Benjamim";
  return base;
}

function exportViaPrint() {
  window.print();
}

interface DashboardData {
  Geração: string;
  Célula: string;
  Data: string;
  Membros: number;
  Visitantes: number;
  Conversão: number;
  Total_Presentes: number;
  Taxa_Conversao: number;
}

const MONTHS = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" }, { value: "4", label: "Abril" },
  { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData[]>([]);
  const [filteredData, setFilteredData] = useState<DashboardData[]>([]);
  const [selectedCell, setSelectedCell] = useState<string>("Todas");
  const [selectedMonth, setSelectedMonth] = useState<string>("Todos");
  const [selectedYear, setSelectedYear] = useState<string>("Todos");
  const [cells, setCells] = useState<string[]>([]);
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"Visitantes" | "Membros" | "Conversão" | "Total">("Visitantes");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let baseData: DashboardData[] = [];
    fetch("/dashboard_data.json")
      .then((res) => res.json())
      .then((json: DashboardData[]) => {
        baseData = json;
        const stored = localStorage.getItem(STORAGE_KEY);
        const extra = stored ? (JSON.parse(stored) as DashboardData[]) : [];
        const merged = [...baseData, ...extra];
        setData(merged);
        const all = merged;
        const cellSet = new Set(all.map((d) => d.Célula));
        const yearSet = new Set(all.map((d) => d.Data.split("-")[0]));
        setCells(["Todas", ...Array.from(cellSet)]);
        setYears(["Todos", ...Array.from(yearSet).sort((a, b) => b.localeCompare(a))]);
        setMonths([{ value: "Todos", label: "Todos os meses" }, ...MONTHS]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar dados:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let filtered = data;
    if (selectedCell !== "Todas") {
      filtered = filtered.filter((d) => d.Célula === selectedCell);
    }
    if (selectedYear !== "Todos") {
      filtered = filtered.filter((d) => d.Data.startsWith(selectedYear));
    }
    if (selectedMonth !== "Todos") {
      const targetMonth = selectedMonth.padStart(2, "0");
      filtered = filtered.filter((d) => d.Data.split("-")[1] === targetMonth);
    }
    setFilteredData(filtered);
  }, [selectedCell, selectedMonth, selectedYear, data]);

  // KPIs: Membros e Presentes usam MÁXIMO por célula (evita contar a mesma pessoa N vezes em N reuniões)
  // Sem presença nominal, o máximo reportado em uma reunião por célula aproxima o tamanho real do grupo
  const { totalMembros, totalVisitantes, totalPresentes } = useMemo(() => {
    const byCell = new Map<
      string,
      { maxMembros: number; maxVisitantes: number; maxPresentes: number }
    >();
    for (const d of filteredData) {
      const cur = byCell.get(d.Célula) ?? {
        maxMembros: 0,
        maxVisitantes: 0,
        maxPresentes: 0,
      };
      cur.maxMembros = Math.max(cur.maxMembros, d.Membros);
      cur.maxVisitantes = Math.max(cur.maxVisitantes, d.Visitantes);
      cur.maxPresentes = Math.max(cur.maxPresentes, d.Membros + d.Visitantes);
      byCell.set(d.Célula, cur);
    }
    let m = 0,
      v = 0,
      p = 0;
    byCell.forEach((val) => {
      m += val.maxMembros;
      v += val.maxVisitantes;
      p += val.maxPresentes;
    });
    return { totalMembros: m, totalVisitantes: v, totalPresentes: p };
  }, [filteredData]);

  const totalConversoes = filteredData.reduce((sum, d) => sum + d.Conversão, 0);
  const mediaConversao =
    filteredData.length > 0
      ? (filteredData.reduce((sum, d) => sum + d.Taxa_Conversao, 0) / filteredData.length).toFixed(1)
      : 0;

  // Dados por data (série temporal) - memoizado
  const timeSeriesData = useMemo(() => filteredData.reduce(
    (acc, d) => {
      const existing = acc.find((item) => item.Data === d.Data);
      if (existing) {
        existing.Visitantes += d.Visitantes;
        existing.Membros += d.Membros;
        existing.Conversão += d.Conversão;
      } else {
        acc.push({
          Data: d.Data,
          Visitantes: d.Visitantes,
          Membros: d.Membros,
          Conversão: d.Conversão,
        });
      }
      return acc;
    },
    [] as Array<{ Data: string; Visitantes: number; Membros: number; Conversão: number }>
  ).sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime()), [filteredData]);

  type CellRow = { Célula: string; Visitantes: number; Membros: number; Conversão: number };
  const cellDataRaw = useMemo(() => {
    const byCell = new Map<string, { v: number; m: number; c: number }>();
    for (const d of filteredData) {
      const cur = byCell.get(d.Célula) ?? { v: 0, m: 0, c: 0 };
      cur.v = Math.max(cur.v, d.Visitantes);
      cur.m = Math.max(cur.m, d.Membros);
      cur.c += d.Conversão;
      byCell.set(d.Célula, cur);
    }
    return Array.from(byCell.entries()).map(([Célula, { v, m, c }]) => ({
      Célula,
      Visitantes: v,
      Membros: m,
      Conversão: c,
    }));
  }, [filteredData]);

  const getSortValue = (row: CellRow) =>
    sortBy === "Total" ? row.Membros + row.Visitantes : row[sortBy];

  const cellData = useMemo(
    () => [...cellDataRaw].sort((a, b) => getSortValue(b) - getSortValue(a)),
    [cellDataRaw, sortBy]
  );

  // Lista de todas as gerações (derivadas do nome da célula) no dataset completo
  const allGenerations = useMemo(() => {
    const set = new Set(
      data.map((d) => getGeracaoFromCelula(d.Célula)).filter((g) => g)
    );
    return Array.from(set).sort();
  }, [data]);

  // Dados por geração - derivado do nome da célula (Filhos/Filhas de Sião → Sião; Benjamim → Benjamim)
  // Max por célula (evita inflar) + soma conversões. Inclui TODAS as gerações (com 0 quando ausente)
  const geraçãoData = useMemo(() => {
    const byGenCell = new Map<
      string,
      { maxM: number; maxV: number; conv: number }
    >();
    for (const d of filteredData) {
      const gen = getGeracaoFromCelula(d.Célula);
      if (!gen) continue;
      const key = `${gen}|${d.Célula}`;
      const cur = byGenCell.get(key) ?? { maxM: 0, maxV: 0, conv: 0 };
      cur.maxM = Math.max(cur.maxM, d.Membros);
      cur.maxV = Math.max(cur.maxV, d.Visitantes);
      cur.conv += d.Conversão;
      byGenCell.set(key, cur);
    }
    const byGen = new Map<string, { Visitantes: number; Membros: number; Conversão: number }>();
    byGenCell.forEach((val, key) => {
      const gen = key.split("|")[0];
      const cur = byGen.get(gen) ?? { Visitantes: 0, Membros: 0, Conversão: 0 };
      cur.Membros += val.maxM;
      cur.Visitantes += val.maxV;
      cur.Conversão += val.conv;
      byGen.set(gen, cur);
    });
    return allGenerations.map((Geração) => ({
      Geração,
      Membros: byGen.get(Geração)?.Membros ?? 0,
      Visitantes: byGen.get(Geração)?.Visitantes ?? 0,
      Conversão: byGen.get(Geração)?.Conversão ?? 0,
    }));
  }, [filteredData, allGenerations]);

  // Ranking por célula (usa mesma ordenação selecionada)
  const rankingData = useMemo(
    () =>
      cellData.map((c) => ({
        Célula: c.Célula,
        Valor: getSortValue(c),
        Métrica: sortBy,
      })),
    [cellData, sortBy]
  );

  const parseRowToData = (row: Record<string, unknown>): DashboardData => {
    const get = (keys: string[]) => {
      const k = Object.keys(row).find((key) =>
        keys.some((kk) => String(key).toLowerCase().includes(kk))
      );
      return k ? row[k] : "";
    };
    const getNum = (keys: string[]) => Number(get(keys)) || 0;
    let dataVal = get(["data"]);
    let dataStr = "";
    if (dataVal instanceof Date) {
      dataStr = dataVal.toISOString().slice(0, 10);
    } else if (typeof dataVal === "number") {
      const d = new Date((dataVal - 25569) * 86400 * 1000);
      dataStr = d.toISOString().slice(0, 10);
    } else {
      dataStr = String(dataVal ?? "");
    }
    return {
      Geração: String(get(["gera", "geração"])),
      Célula: String(get(["célula", "celula"])),
      Data: dataStr,
      Membros: getNum(["membro"]),
      Visitantes: getNum(["visitante"]),
      Conversão: getNum(["convers", "conversao"]),
      Total_Presentes: 0,
      Taxa_Conversao: 0,
    };
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, merge: boolean) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        let imported: DashboardData[] = [];
        if (isExcel) {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(reader.result, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
          imported = rows.map(parseRowToData);
        } else {
          const text = reader.result as string;
          if (file.name.toLowerCase().endsWith(".csv")) {
            const lines = text.split("\n").filter(Boolean);
            const sep = text.includes(";") ? ";" : ",";
            const headers = lines[0].split(sep).map((h) => h.trim());
            const idx = (k: string) =>
              headers.findIndex((h) => h.toLowerCase().includes(k));
            const iGen = idx("gera") >= 0 ? idx("gera") : idx("geração");
            const iCel = idx("célula") >= 0 ? idx("célula") : idx("celula");
            const iDat = idx("data");
            const iMem = idx("membro");
            const iVis = idx("visitante");
            const iConv = idx("convers");
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(sep).map((c) => c.trim());
              imported.push({
                Geração: cols[iGen] ?? "",
                Célula: cols[iCel] ?? "",
                Data: cols[iDat] ?? "",
                Membros: Number(cols[iMem]) || 0,
                Visitantes: Number(cols[iVis]) || 0,
                Conversão: Number(cols[iConv]) || 0,
                Total_Presentes: 0,
                Taxa_Conversao: 0,
              });
            }
          } else {
            imported = JSON.parse(text) as DashboardData[];
            if (!Array.isArray(imported)) imported = [imported];
          }
        }
        const normalized = imported.map((d) => {
          const m = Number(d.Membros) || 0;
          const v = Number(d.Visitantes) || 0;
          return {
            ...d,
            Membros: m,
            Visitantes: v,
            Conversão: Number(d.Conversão) || 0,
            Total_Presentes: m + v,
            Taxa_Conversao: Number(d.Taxa_Conversao) || 0,
          };
        });
        if (merge) {
          const stored = localStorage.getItem(STORAGE_KEY);
          const prev = stored ? (JSON.parse(stored) as DashboardData[]) : [];
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...prev, ...normalized]));
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
        window.location.reload();
      } catch (err) {
        setImportError("Arquivo inválido. Use JSON, CSV ou Excel (.xlsx) no formato correto.");
      }
    };
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
    e.target.value = "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#1e40af] border-t-[#d97706] mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div>
        <DashboardHeader />

        <div className="max-w-7xl mx-auto p-6">
        {/* Filtros */}
        <div className="mb-8 bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Célula
              </label>
              <Select value={selectedCell} onValueChange={setSelectedCell}>
                <SelectTrigger className="w-full border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cells.map((cell) => (
                    <SelectItem key={cell} value={cell}>
                      {cell}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mês
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCell("Todas");
                  setSelectedMonth("Todos");
                  setSelectedYear("Todos");
                }}
                className="w-full border-[#1e40af] text-[#1e40af] hover:bg-[#1e40af] hover:text-white"
              >
                Resetar Filtros
              </Button>
            </div>
          </div>

          {/* Ordenar células por */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordenar células por
            </label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full max-w-xs border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Visitantes">Quem teve mais visitantes</SelectItem>
                <SelectItem value="Membros">Quem tem mais membros</SelectItem>
                <SelectItem value="Conversão">Quem tem mais conversões</SelectItem>
                <SelectItem value="Total">Maior total (membros + visitantes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Adicionar dados e Imprimir / Salvar PDF */}
          <div className="mt-4 pt-4 border-t border-gray-200 no-print">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Dados</h4>
            <div className="flex flex-wrap gap-3">
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                className="hidden"
                id="import-merge"
                onChange={(e) => handleImport(e, true)}
              />
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                onClick={() => document.getElementById("import-merge")?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Adicionar dados
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-600 text-rose-600 hover:bg-rose-50"
                onClick={exportViaPrint}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Imprimir / Salvar PDF
              </Button>
            </div>
            {importError && (
              <p className="text-red-600 text-sm mt-2">{importError}</p>
            )}
          </div>
        </div>

        {/* KPIs - Membros/Visitantes/Presentes: máx. por célula (aprox. sem dados nominais) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard
            title="Visitantes (aprox.)"
            value={totalVisitantes}
            icon={<Users className="w-6 h-6 text-[#d97706]" />}
            borderColor="border-l-[#d97706]"
            bgColor="bg-[#fef3c7]"
          />

          <StatCard
            title="Membros (aprox.)"
            value={totalMembros}
            icon={<Zap className="w-6 h-6 text-[#dc2626]" />}
            borderColor="border-l-[#dc2626]"
            bgColor="bg-[#fee2e2]"
          />

          <StatCard
            title="Presentes (aprox.)"
            value={totalPresentes}
            icon={<BarChart3 className="w-6 h-6 text-[#1e40af]" />}
            borderColor="border-l-[#1e40af]"
            bgColor="bg-[#dbeafe]"
          />

          <StatCard
            title="Total Conversões"
            value={totalConversoes}
            icon={<TrendingUp className="w-6 h-6 text-[#10b981]" />}
            borderColor="border-l-[#10b981]"
            bgColor="bg-[#d1fae5]"
          />

          <StatCard
            title="Taxa Conversão"
            value={`${mediaConversao}%`}
            icon={<Target className="w-6 h-6 text-[#ec4899]" />}
            borderColor="border-l-[#ec4899]"
            bgColor="bg-[#fce7f3]"
          />

          <StatCard
            title="Total de Células"
            value={cellData.length}
            icon={<LayoutGrid className="w-6 h-6 text-[#7c2d12]" />}
            borderColor="border-l-[#7c2d12]"
            bgColor="bg-[#fff7ed]"
          />
        </div>

        {/* Gráficos Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Série Temporal */}
          <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#d97706] rounded"></div>
              Evolução Temporal
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorVisitantes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMembros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="Data"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #d97706",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Visitantes"
                  stroke="#d97706"
                  fillOpacity={1}
                  fill="url(#colorVisitantes)"
                  name="Visitantes"
                />
                <Area
                  type="monotone"
                  dataKey="Membros"
                  stroke="#dc2626"
                  fillOpacity={1}
                  fill="url(#colorMembros)"
                  name="Membros"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Comparativo por Célula */}
          <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#1e40af] rounded"></div>
              Visitantes por Célula
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cellData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="Célula"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #1e40af",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="Visitantes" fill="#d97706" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Gráficos Secundários */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Membros vs Visitantes */}
          <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#10b981] rounded"></div>
              Membros vs Visitantes
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cellData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="Célula"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #10b981",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Bar dataKey="Membros" fill="#dc2626" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Visitantes" fill="#d97706" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Ranking de Células - ordenável por métrica */}
          <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#ec4899] rounded"></div>
              Ranking de Células
              <span className="text-sm font-normal text-gray-600">
                (por {sortBy === "Total" ? "total presentes" : sortBy.toLowerCase()})
              </span>
            </h2>
            <div className="max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {rankingData.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">Nenhum dado nos filtros selecionados</p>
              ) : (
                <ul className="space-y-2">
                  {rankingData.map((item, idx) => (
                    <li
                      key={item.Célula}
                      className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-pink-50/60 transition-colors"
                    >
                      <span className="font-medium text-gray-800 truncate flex-1 min-w-0">
                        {idx + 1}. {item.Célula}
                      </span>
                      <span
                        className="shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: "rgba(236, 72, 153, 0.15)",
                          color: "#be185d",
                        }}
                      >
                        {Number(item.Valor).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Gráfico por Geração */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#7c2d12] rounded"></div>
              Performance por Geração
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={geraçãoData} margin={{ bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="Geração"
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #7c2d12",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Bar dataKey="Membros" fill="#dc2626" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Visitantes" fill="#d97706" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Conversão" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Tabela de Dados */}
        <Card className="p-6 shadow-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-[#fcd34d] rounded"></div>
            Resumo por Célula
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">Célula</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-900">Membros</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-900">Visitantes</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-900">Total</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-900">Conversões</th>
                </tr>
              </thead>
              <tbody>
                {cellData.map((row, idx) => (
                  <tr
                    key={row.Célula}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{row.Célula}</td>
                    <td className="px-4 py-3 text-right text-[#dc2626] font-semibold">
                      {row.Membros.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-[#d97706] font-semibold">
                      {row.Visitantes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-[#1e40af] font-semibold">
                      {(row.Membros + row.Visitantes).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-[#10b981] font-semibold">
                      {row.Conversão.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>Dashboard de Células © 2026 - Dados atualizados em tempo real</p>
          <p className="mt-1 text-xs text-gray-500">
            Gerado em {new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
