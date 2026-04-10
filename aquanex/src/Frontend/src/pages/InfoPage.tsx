import { Info, HelpCircle, FileText, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Information = () => {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 border-b border-cyan-100 pb-4">
        <div className="bg-cyan-100 p-2 rounded-lg">
          <Info className="w-6 h-6 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Information</h1>
          <p className="text-slate-500 text-sm">Overview of the AquaNex management platform and modules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-cyan-600" />
              User Documentation
            </CardTitle>
            <CardDescription>Learn how to manage your workspace and pipelines.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Access the full guide on configuring sensors, managing alerts, and interpreting 
            the demand forecasting machine learning models.
          </CardContent>
        </Card>

        <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5 text-cyan-600" />
              Support Center
            </CardTitle>
            <CardDescription>Need help or found a bug?</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Contact your local system administrator or visit our online help portal for 
            technical assistance with gateway connectivity issues.
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Information;