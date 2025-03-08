import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import NewPurchaseRequestForm from "./pages/NewPurchaseRequestForm";
import EditRequest from "./pages/EditRequest";
import ViewRequest from "./pages/ViewRequest";
import AdminPanel from "./pages/AdminPanel";
import ErrorDashboard from "./pages/ErrorDashboard";
import ErrorLookupGuide from "./components/ErrorLookupGuide";
import VendorManagement from "./pages/VendorManagement";
import DepartmentDashboard from "./pages/DepartmentDashboard";
import BulkExportPage from "./pages/BulkExportPage";
import NotificationsPage from "./pages/NotificationsPage";
import PDFDesignPage from "./pages/PDFDesignPage";
import { NotFound } from "@/components/NotFound";
import ErrorPredictionDashboard from "./components/ErrorPredictionDashboard";
import TestExportPage from "./pages/TestExportPage";
import { ThemeProvider } from "@/contexts/ThemeContext";

function App() {
  const { user, isLoading } = useUser();

  // Create content based on auth state
  const renderContent = () => {
    // Show loading spinner while checking auth status
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Show auth page if not logged in
    if (!user) {
      return <AuthPage />;
    }

    // Show main app routes if logged in
    return (
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/new-request" component={NewPurchaseRequestForm} />
        <Route path="/requests/:id" component={ViewRequest} />
        <Route path="/requests/:id/edit" component={EditRequest} />
        <Route path="/department-dashboard" component={DepartmentDashboard} />
        <Route path="/error-predictions" component={ErrorPredictionDashboard} />
        <Route path="/test-export" component={TestExportPage} />
        <Route path="/export" component={BulkExportPage} />
        <Route path="/notifications" component={NotificationsPage} />

        {/* Add admin routes with proper access control */}
        {user.role === "admin" && (
          <>
            <Route path="/admin" component={AdminPanel} />
            <Route path="/admin/vendors" component={VendorManagement} />
            <Route path="/admin/account-requests" component={AdminPanel} />
            <Route path="/admin/error-analytics" component={ErrorDashboard} />
            <Route path="/admin/error-lookup" component={ErrorLookupGuide} />
            <Route path="/admin/error-predictions" component={ErrorPredictionDashboard} />
            <Route path="/admin/pdf-design" component={PDFDesignPage} />
          </>
        )}

        {/* 404 route handler */}
        <Route component={NotFound} />
      </Switch>
    );
  };

  // Wrap all content with ThemeProvider
  return (
    <ThemeProvider>
      {renderContent()}
    </ThemeProvider>
  );
}

export default App;