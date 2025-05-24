import React from 'react';
import { 
  LucideArrowRight, 
  LucideBarChart3, 
  LucideCheckCircle2, 
  LucideFileStack
} from "lucide-react";

/**
 * SimplifiedBentoExample - Minimal version with no animations
 */
export function BentoLiquidExample() {
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">UI Component Examples</h2>
      
      <div className="bento-grid">
        {/* Main Card */}
        <div className="bento-card bento-card-md">
          <h3 className="text-xl font-semibold mb-2">Feature Overview</h3>
          <p className="text-muted-foreground mb-4">
            Clean interface with modern design elements
          </p>
          <div className="flex items-center text-primary">
            <span>Learn more</span>
            <LucideArrowRight className="ml-2 h-4 w-4" />
          </div>
        </div>
        
        {/* Simple Card */}
        <div className="bento-card bento-card-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">Analytics</h3>
              <p className="text-muted-foreground">
                Data visualization and reporting
              </p>
            </div>
            <LucideBarChart3 className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Simple Card */}
        <div className="bento-card bento-card-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">File Management</h3>
              <p className="text-muted-foreground">
                Organize documents efficiently
              </p>
            </div>
            <LucideFileStack className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Simple Card */}
        <div className="bento-card bento-card-md">
          <h3 className="text-xl font-semibold mb-2">Workflow Management</h3>
          <p className="text-muted-foreground mb-4">
            Streamlined process management
          </p>
          <div className="flex items-center mt-4">
            <LucideCheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
            <span>Improved productivity</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-muted-foreground">
        <p>
          Lightweight UI components built with Tailwind CSS
        </p>
      </div>
    </div>
  );
}

export default BentoLiquidExample;