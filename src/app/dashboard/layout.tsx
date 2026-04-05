import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pl-72 h-screen overflow-hidden">
        <TopNav />
        
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto bg-background px-12 py-10 custom-scrollbar relative">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
          
          {/* Subtle Background Glows (Rich Aesthetics) */}
          <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-brand-primary/10 blur-[160px] pointer-events-none -z-10 animate-pulse duration-[10s]" />
          <div className="fixed bottom-0 left-72 w-1/3 h-1/3 bg-brand-secondary/10 blur-[160px] pointer-events-none -z-10 animate-pulse duration-[15s]" />
        </main>
      </div>
    </div>
  );
}
