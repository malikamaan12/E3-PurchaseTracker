import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import EditRequest from "./pages/EditRequest";
import ViewRequest from "./pages/ViewRequest";
import AdminPanel from "./pages/AdminPanel";
import ErrorDashboard from "./pages/ErrorDashboard";

function App() {
  const { user, isLoading } = useUser();

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
      <Route path="/new-request" component={NewRequest} />
      <Route path="/requests/:id" component={ViewRequest} />
      <Route path="/requests/:id/edit" component={EditRequest} />
      {user.role === "admin" && (
        <>
          <Route path="/admin" component={AdminPanel} />
          <Route path="/admin/error-analytics" component={ErrorDashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

export default App;