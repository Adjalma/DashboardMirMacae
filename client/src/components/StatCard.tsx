import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  borderColor: string;
  bgColor: string;
  trend?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  borderColor,
  bgColor,
}: StatCardProps) {
  return (
    <Card
      className={`p-6 border-l-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2 font-mono">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
