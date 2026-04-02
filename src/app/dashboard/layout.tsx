import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pl-72 min-h-screen">
        <TopNav />
        
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto bg-zinc-950/20 custom-scrollbar relative p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
          
          {/* Subtle Background Glows (Rich Aesthetics) */}
          <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-brand-primary/5 blur-[120px] pointer-events-none -z-10" />
          <div className="fixed bottom-0 left-72 w-1/3 h-1/3 bg-brand-secondary/5 blur-[120px] pointer-events-none -z-10" />
        </main>
      </div>
    </div>
  );
}
