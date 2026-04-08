import TopNav from "@/components/layout/TopNav";
import AmbientBackground from "@/components/layout/AmbientBackground";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* Top Navigation */}
      <TopNav />
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto bg-background px-12 py-10 custom-scrollbar relative">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
          
          <AmbientBackground />
        </main>
      </div>
    </div>
  );
}
