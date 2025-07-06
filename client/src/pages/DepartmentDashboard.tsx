import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
// Recharts imports no longer needed as they're handled by modular components
import { RequestsByStatusChart, useRequestStatusData } from "@/components/RequestsByStatusChart";
import { RequestsByPurposeChart, useRequestPurposeData } from "@/components/charts/RequestsByPurposeChart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, CheckCircle, XCircle, Clock, AlertCircle, Download } from "lucide-react";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PurchaseRequest {
  id: number;
  title: string;
  status: string;
  purposeType: string;
  totalEstimatedCost: number;
  createdAt: string;
  vendorId?: number;
  subPurposeId?: number;
  currency?: string;
}

interface Vendor {
  id: number;
  name?: string;
  companyName: string;
}

interface SubPurpose {
  id: number;
  name: string;
}

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
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: async (): Promise<Vendor[]> => {
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

    return requests.filter((request: PurchaseRequest) => {
      const vendorMatch = selectedVendor === "all" || request.vendorId?.toString() === selectedVendor;
      const purposeMatch = selectedPurpose === "all" || request.purposeType === selectedPurpose;
      const subPurposeMatch = selectedSubPurpose === "all" || request.subPurposeId?.toString() === selectedSubPurpose;

      return vendorMatch && purposeMatch && subPurposeMatch;
    });
  }, [requests, selectedVendor, selectedPurpose, selectedSubPurpose]);

  // Calculate statistics
  // Cache for currency conversion rates by date
  const [conversionRatesCache, setConversionRatesCache] = useState<Record<string, Record<string, number>>>({});
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Function to get conversion rate from API
  const getConversionRate = useCallback(async (fromCurrency: string, toCurrency: string, date: string) => {
    // If it's already QAR, return 1
    if (fromCurrency === toCurrency) return 1;

    // Check if we have this rate cached for this date
    if (conversionRatesCache[date] && conversionRatesCache[date][`${fromCurrency}_${toCurrency}`]) {
      return conversionRatesCache[date][`${fromCurrency}_${toCurrency}`];
    }

    try {
      setIsLoadingRates(true);
      
      // Using a real currency conversion API
      // Note: In production, you would need to provide your API key
      const response = await fetch(
        `https://api.exchangerate.host/${date}?base=${fromCurrency}&symbols=${toCurrency}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
      }
      
      const data = await response.json();
      let rate = 1;
      
      if (data && data.rates && data.rates[toCurrency]) {
        rate = data.rates[toCurrency];
      } else {
        // Fallback to default rates if API call fails or returns incomplete data
        const defaultRates: Record<string, number> = {
          'USD_QAR': 3.64,
          'EUR_QAR': 4.00,
          'GBP_QAR': 4.68,
        };
        const rateKey = `${fromCurrency}_${toCurrency}`;
        rate = defaultRates[rateKey] || 1;
        console.warn(`Using fallback rate for ${fromCurrency} to ${toCurrency}: ${rate}`);
      }

      // Cache the rate
      setConversionRatesCache(prevCache => ({
        ...prevCache,
        [date]: {
          ...(prevCache[date] || {}),
          [`${fromCurrency}_${toCurrency}`]: rate
        }
      }));

      return rate;
    } catch (error) {
      console.error("Error fetching conversion rate:", error);
      
      // Use fallback rates if API call fails
      const fallbackRates: Record<string, number> = {
        'USD_QAR': 3.64,
        'EUR_QAR': 4.00,
        'GBP_QAR': 4.68,
      };
      
      const rateKey = `${fromCurrency}_${toCurrency}`;
      const fallbackRate = fallbackRates[rateKey] || 1;
      
      // Cache the fallback rate to avoid repeated failed API calls
      setConversionRatesCache(prevCache => ({
        ...prevCache,
        [date]: {
          ...(prevCache[date] || {}),
          [`${fromCurrency}_${toCurrency}`]: fallbackRate
        }
      }));
      
      return fallbackRate;
    } finally {
      setIsLoadingRates(false);
    }
  }, [conversionRatesCache]);

  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const approved = filteredRequests.filter((r: PurchaseRequest) => r.status === "approved").length;
    const rejected = filteredRequests.filter((r: PurchaseRequest) => r.status === "rejected").length;
    const pending = filteredRequests.filter((r: PurchaseRequest) => r.status === "pending").length;
    const draft = filteredRequests.filter((r: PurchaseRequest) => r.status === "draft").length;

    // Calculate total with currency conversion to QAR
    // Since API calls are async and useMemo is sync, we need another approach
    // For now, using the cache we've built up
    const totalAmount = filteredRequests.reduce((sum: number, request: PurchaseRequest) => {
      // Get the amount in the request's currency
      const amount = request.totalEstimatedCost || 0;
      
      // Apply currency conversion if needed
      let convertedAmount = amount;
      const currency = request.currency || 'QAR';
      const date = request.createdAt.split('T')[0]; // Get just the date part
      
      if (currency !== 'QAR') {
        // If we have a cached rate for this date and currency pair, use it
        if (conversionRatesCache[date] && conversionRatesCache[date][`${currency}_QAR`]) {
          const rate = conversionRatesCache[date][`${currency}_QAR`];
          convertedAmount = amount * rate;
        } else {
          // Otherwise use a default rate (the API call will happen in useEffect)
          const defaultRates: Record<string, number> = {
            'USD': 3.64,
            'EUR': 4.00,
            'GBP': 4.68,
          };
          const rate = defaultRates[currency] || 1;
          convertedAmount = amount * rate;
        }
      }
      
      return sum + convertedAmount;
    }, 0);

    return { total, approved, rejected, pending, draft, totalAmount };
  }, [filteredRequests, conversionRatesCache]);
  
  // Effect to fetch conversion rates for each unique currency and date
  useEffect(() => {
    const fetchRates = async () => {
      // Only do this if we have requests
      if (!filteredRequests.length) return;
      
      // Get unique currency/date pairs that need conversion
      const requestsNeedingConversion = filteredRequests.filter(
        (r: PurchaseRequest) => (r.currency || 'QAR') !== 'QAR'
      );

      if (!requestsNeedingConversion.length) return;
      
      for (const request of requestsNeedingConversion) {
        const currency = request.currency || 'QAR';
        const date = request.createdAt.split('T')[0];
        
        // Skip if we already have this rate
        if (conversionRatesCache[date] && conversionRatesCache[date][`${currency}_QAR`]) {
          continue;
        }
        
        // Fetch rate
        await getConversionRate(currency, 'QAR', date);
      }
    };
    
    fetchRates();
  }, [filteredRequests, conversionRatesCache, getConversionRate]);

  // Prepare data for charts using the modular hooks
  const statusData = useRequestStatusData(filteredRequests);
  const purposeData = useRequestPurposeData(filteredRequests);

  // Export functions
  const prepareExportData = () => {
    return filteredRequests.map((request: PurchaseRequest) => ({
      'Request ID': request.id,
      'Title': request.title,
      'Status': request.status,
      'Purpose': request.purposeType,
      'Total Amount': request.totalEstimatedCost,
      'Created At': new Date(request.createdAt).toLocaleDateString(),
      'Vendor': vendors.find((v: Vendor) => v.id === request.vendorId)?.name || 'N/A',
      'Sub Purpose': subPurposes.find((sp: SubPurpose) => sp.id === request.subPurposeId)?.name || 'N/A'
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
        ...exportData.map((row: Record<string, any>) => Object.values(row).join(',')) // Data rows
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
        className: "bg-green-50 border-green-200 text-green-800",
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
      setIsExporting(true);
      
      // Calculate statistics
      const approvedCount = filteredRequests.filter((r: PurchaseRequest) => r.status === "approved").length;
      const rejectedCount = filteredRequests.filter((r: PurchaseRequest) => r.status === "rejected").length;
      const pendingCount = filteredRequests.filter((r: PurchaseRequest) => r.status === "pending").length;
      const draftCount = filteredRequests.filter((r: PurchaseRequest) => r.status === "draft").length;
      
      const requestTotal = filteredRequests.reduce((sum: number, request: PurchaseRequest) => {
        return sum + (request.totalEstimatedCost || 0);
      }, 0);
      
      const foreignCurrencyItemsCount = filteredRequests.filter(
        (r: PurchaseRequest) => (r.currency || 'QAR') !== 'QAR'
      ).length;
      
      // Generate PDF report
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('Department Analytics Report', 20, 20);
      
      // Date and filters
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      doc.text(`Total Requests: ${filteredRequests.length}`, 20, 40);
      
      // Filter information
      let yPosition = 55;
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Applied Filters:', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`Vendor: ${selectedVendor === 'all' ? 'All Vendors' : vendors.find(v => v.id.toString() === selectedVendor)?.companyName || 'Unknown'}`, 30, yPosition);
      yPosition += 8;
      doc.text(`Purpose: ${selectedPurpose === 'all' ? 'All Purposes' : selectedPurpose}`, 30, yPosition);
      yPosition += 8;
      doc.text(`Sub-Purpose: ${selectedSubPurpose === 'all' ? 'All Sub-Purposes' : subPurposes.find((sp: SubPurpose) => sp.id.toString() === selectedSubPurpose)?.name || 'Unknown'}`, 30, yPosition);
      yPosition += 20;
      
      // Status Summary
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Status Summary:', 20, yPosition);
      yPosition += 15;
      
      const statusData = [
        ['Status', 'Count', 'Percentage'],
        ['Approved', approvedCount.toString(), `${((approvedCount / filteredRequests.length) * 100).toFixed(1)}%`],
        ['Rejected', rejectedCount.toString(), `${((rejectedCount / filteredRequests.length) * 100).toFixed(1)}%`],
        ['Pending', pendingCount.toString(), `${((pendingCount / filteredRequests.length) * 100).toFixed(1)}%`],
        ['Draft', draftCount.toString(), `${((draftCount / filteredRequests.length) * 100).toFixed(1)}%`]
      ];
      
      (doc as any).autoTable({
        head: [statusData[0]],
        body: statusData.slice(1),
        startY: yPosition,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        margin: { left: 20, right: 20 }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 20;
      
      // Purpose Breakdown
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Purpose Breakdown:', 20, yPosition);
      yPosition += 15;
      
      const purposeCounts = filteredRequests.reduce((acc: any, request: PurchaseRequest) => {
        const purpose = request.purposeType || 'Unknown';
        if (!acc[purpose]) {
          acc[purpose] = { count: 0, amount: 0 };
        }
        acc[purpose].count++;
        acc[purpose].amount += request.totalEstimatedCost || 0;
        return acc;
      }, {});
      
      const purposeData = [
        ['Purpose', 'Count', 'Total Amount (QAR)'],
        ...Object.entries(purposeCounts).map(([purpose, data]: [string, any]) => [
          purpose,
          data.count.toString(),
          data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
        ])
      ];
      
      (doc as any).autoTable({
        head: [purposeData[0]],
        body: purposeData.slice(1),
        startY: yPosition,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        margin: { left: 20, right: 20 }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 20;
      
      // Financial Summary
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Financial Summary:', 20, yPosition);
      yPosition += 15;
      
      const financialData = [
        ['Metric', 'Amount (QAR)'],
        ['Total Amount', requestTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })],
        ['Average Request', (requestTotal / filteredRequests.length).toLocaleString('en-US', { minimumFractionDigits: 2 })],
        ['Foreign Currency Items', foreignCurrencyItemsCount.toString()]
      ];
      
      (doc as any).autoTable({
        head: [financialData[0]],
        body: financialData.slice(1),
        startY: yPosition,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [239, 68, 68], textColor: 255 },
        margin: { left: 20, right: 20 }
      });
      
      // Save the PDF
      const fileName = `department-analytics-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "✅ PDF Report Generated",
        description: "Analytics report has been downloaded successfully",
        className: "bg-green-50 border-green-200 text-green-800 shadow-lg",
      });
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {!isMobile && <span>Generating...</span>}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                {!isMobile && <span>PDF Report</span>}
              </>
            )}
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
            {vendors.map((vendor: Vendor) => (
              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                {vendor.companyName || vendor.name || `Vendor #${vendor.id}`}
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
            {subPurposes.map((purpose: SubPurpose) => (
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
                currency: "QAR",
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <RequestsByStatusChart 
          data={statusData}
          title="Requests by Status"
          description="Distribution of purchase requests across different status categories"
          showLegend={true}
          chartHeight={320}
          onRefresh={() => window.location.reload()}
          onExport={() => {
            const csvData = statusData
              .filter(item => item.value > 0)
              .map(item => `${item.name},${item.value}`)
              .join('\n');
            const blob = new Blob([`Status,Count\n${csvData}`], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'requests-by-status.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        />

        <RequestsByPurposeChart 
          data={purposeData}
          title="Requests by Purpose"
          description="Number of purchase requests grouped by purpose type"
          chartHeight={320}
          barColor="#6366F1"
          onRefresh={() => window.location.reload()}
          onExport={() => {
            const csvData = purposeData
              .filter(item => item.value > 0)
              .map(item => `${item.name},${item.value}`)
              .join('\n');
            const blob = new Blob([`Purpose,Count\n${csvData}`], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'requests-by-purpose.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      </div>


    </div>
  );
}