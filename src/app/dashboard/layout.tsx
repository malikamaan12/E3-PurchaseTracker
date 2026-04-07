import TopNav from "@/components/layout/TopNav";

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
          
        {/* Premium Ambient Background (Fluid Blobs) */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none select-none -z-10">
          <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-brand-primary/15 dark:bg-brand-primary/25 rounded-full blur-[120px] animate-fluid-drift" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-brand-secondary/15 dark:bg-brand-secondary/25 rounded-full blur-[120px] animate-fluid-drift [animation-delay:2.5s]" />
          <div className="absolute top-[30%] right-[5%] w-[35%] h-[35%] bg-brand-mid/10 dark:bg-brand-mid/20 rounded-full blur-[110px] animate-fluid-drift [animation-delay:5s]" />
          <div className="absolute bottom-[20%] left-[30%] w-[30%] h-[30%] bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 rounded-full blur-[100px] animate-fluid-drift [animation-delay:7.5s]" />
          
          {/* Fine grain overlay for premium texture */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none brightness-100 contrast-150" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
        </div>
      </main>
    </div>
  </div>
);
}
