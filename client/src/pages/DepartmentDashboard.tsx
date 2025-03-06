import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, CheckCircle, XCircle, Clock, AlertCircle, Download, Share2 } from "lucide-react";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

export default function DepartmentDashboard() {
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [selectedSubPurpose, setSelectedSubPurpose] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { requests, isLoading } = usePurchaseRequests();

  // Fetch vendors for filter
  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const response = await fetch("/api/vendors", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch vendors");
      return response.json();
    },
  });

  // Fetch sub-purposes for filter
  const { data: subPurposes = [] } = useQuery({
    queryKey: ["/api/admin/sub-purposes"],
    queryFn: async () => {
      const response = await fetch("/api/admin/sub-purposes", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch sub-purposes");
      return response.json();
    },
  });

  // Filter requests based on selected filters
  const filteredRequests = useMemo(() => {
    if (!requests) return [];

    return requests.filter((request) => {
      const vendorMatch = selectedVendor === "all" || request.vendorId?.toString() === selectedVendor;
      const purposeMatch = selectedPurpose === "all" || request.purposeType === selectedPurpose;
      const subPurposeMatch = selectedSubPurpose === "all" || request.subPurposeId?.toString() === selectedSubPurpose;

      return vendorMatch && purposeMatch && subPurposeMatch;
    });
  }, [requests, selectedVendor, selectedPurpose, selectedSubPurpose]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const approved = filteredRequests.filter((r) => r.status === "approved").length;
    const rejected = filteredRequests.filter((r) => r.status === "rejected").length;
    const pending = filteredRequests.filter((r) => r.status === "pending").length;
    const draft = filteredRequests.filter((r) => r.status === "draft").length;

    const totalAmount = filteredRequests.reduce(
      (sum, request) => sum + (request.totalEstimatedCost || 0),
      0
    );

    return { total, approved, rejected, pending, draft, totalAmount };
  }, [filteredRequests]);

  // Prepare data for charts
  const statusData = [
    { name: "Approved", value: stats.approved },
    { name: "Rejected", value: stats.rejected },
    { name: "Pending", value: stats.pending },
    { name: "Draft", value: stats.draft },
  ];

  const purposeData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredRequests.forEach((request) => {
      data[request.purposeType] = (data[request.purposeType] || 0) + 1;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredRequests]);

  // Export functions
  const prepareExportData = () => {
    return filteredRequests.map(request => ({
      'Request ID': request.id,
      'Title': request.title,
      'Status': request.status,
      'Purpose': request.purposeType,
      'Total Amount': request.totalEstimatedCost,
      'Created At': new Date(request.createdAt).toLocaleDateString(),
      'Vendor': vendors.find(v => v.id === request.vendorId)?.name || 'N/A',
      'Sub Purpose': subPurposes.find(sp => sp.id === request.subPurposeId)?.name || 'N/A'
    }));
  };

  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const exportData = prepareExportData();

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Add summary sheet
      const summaryData = [
        { Metric: 'Total Requests', Value: stats.total },
        { Metric: 'Approved', Value: stats.approved },
        { Metric: 'Rejected', Value: stats.rejected },
        { Metric: 'Pending', Value: stats.pending },
        { Metric: 'Draft', Value: stats.draft },
        { Metric: 'Total Amount', Value: stats.totalAmount },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Requests");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Generate Excel file
      XLSX.writeFile(wb, `department_dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Dashboard data has been exported to Excel",
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      const exportData = prepareExportData();
      const csv = [
        Object.keys(exportData[0]).join(','), // Header
        ...exportData.map(row => Object.values(row).join(',')) // Data rows
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `department_dashboard_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Dashboard data has been exported to CSV",
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareInsights = async () => {
    try {
      // Get the current dashboard state including filters
      const dashboardState = {
        filters: {
          vendor: selectedVendor,
          purpose: selectedPurpose,
          subPurpose: selectedSubPurpose
        },
        stats,
        statusData,
        purposeData
      };

      // Create a shareable URL with state
      const stateParam = encodeURIComponent(JSON.stringify(dashboardState));
      const shareableUrl = `${window.location.origin}/department-dashboard?state=${stateParam}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareableUrl);

      toast({
        title: "Share Link Copied",
        description: "Dashboard link has been copied to clipboard",
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Failed to generate share link",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Department Dashboard</h1>
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={exportToExcel}
            disabled={isExporting}
            className="flex items-center gap-2 flex-1 sm:flex-auto justify-center"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {!isMobile && <span>Export Excel</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToCSV}
            disabled={isExporting}
            className="flex items-center gap-2 flex-1 sm:flex-auto justify-center"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {!isMobile && <span>Export CSV</span>}
          </Button>
          <Button
            variant="outline"
            onClick={shareInsights}
            className="flex items-center gap-2 flex-1 sm:flex-auto justify-center"
          >
            <Share2 className="h-4 w-4" />
            {!isMobile && <span>Share</span>}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
          <SelectTrigger>
            <SelectValue placeholder="Select Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((vendor: any) => (
              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
          <SelectTrigger>
            <SelectValue placeholder="Select Purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Purposes</SelectItem>
            <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="MALL">Mall</SelectItem>
            <SelectItem value="BUSINESS GROWTH">Business Growth</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedSubPurpose} onValueChange={setSelectedSubPurpose}>
          <SelectTrigger>
            <SelectValue placeholder="Select Sub-Purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub-Purposes</SelectItem>
            {subPurposes.map((purpose: any) => (
              <SelectItem key={purpose.id} value={purpose.id.toString()}>
                {purpose.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalAmount.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Requests by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests by Purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purposeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}