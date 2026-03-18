import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  borderColor: string;
  icon?: ReactNode;
}

export default function ChartCard({
  title,
  children,
  borderColor,
  icon,
}: ChartCardProps) {
  return (
    <Card className="p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 animate-fade-in">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <div className={`w-1 h-6 ${borderColor} rounded`}></div>
        {icon && <span className="text-xl">{icon}</span>}
        {title}
      </h2>
      {children}
    </Card>
  );
}
