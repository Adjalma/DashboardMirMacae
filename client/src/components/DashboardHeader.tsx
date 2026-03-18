import { Activity } from "lucide-react";

export default function DashboardHeader() {
  return (
    <div className="bg-gradient-to-r from-[#1e40af] via-[#d97706] to-[#dc2626] text-white py-8 px-6 rounded-b-2xl shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-8 h-8" />
          <h1 className="text-4xl font-bold">Mir Macaé</h1>
        </div>
        <p className="text-blue-100 text-lg">
          Gestão estratégica de células - Análise de frequência, visitantes e conversão
        </p>
      </div>
    </div>
  );
}
