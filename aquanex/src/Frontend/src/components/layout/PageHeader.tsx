import { ReactNode } from "react";
import { Button } from "@/components/ui/button"; 
import Breadcrumbs from "@/components/Breadcrumbs";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: ReactNode | string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="space-y-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
