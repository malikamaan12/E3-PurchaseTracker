import React from 'react';
import { 
  LucideArrowRight, 
  LucideBarChart3, 
  LucideCheckCircle2, 
  LucideFileStack, 
  LucideSettings,
  LucideExternalLink,
  LucideRefreshCw,
  LucideDroplets,
  LucideSend
} from "lucide-react";

/**
 * BentoLiquidExample - Demonstrates the bento liquid animation styles 
 * available in the application
 */
export function BentoLiquidExample() {
  // Helper function to create wave text with staggered animation
  const createWaveText = (text: string) => {
    return (
      <span className="liquid-wave-text">
        {text.split('').map((letter, index) => (
          <span key={index} style={{ '--i': index } as React.CSSProperties}>
            {letter === ' ' ? '\u00A0' : letter}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Liquid Animation UI Components</h2>
      
      <div className="bento-grid">
        {/* Main Card with Liquid Blob Effect */}
        <div className="bento-card bento-card-md bento-liquid-blob before:bg-primary/10">
          <h3 className="text-xl font-semibold mb-2">Liquid Blob Animation</h3>
          <p className="text-muted-foreground mb-4">
            Cards with organically animated borders that create a fluid, living interface
          </p>
          <div className="flex items-center text-primary">
            <span>Learn more</span>
            <LucideArrowRight className="ml-2 h-4 w-4" />
          </div>
        </div>
        
        {/* Card with Liquid Fill Effect */}
        <div className="bento-card bento-card-sm bento-liquid-fill">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">Liquid Fill</h3>
              <p className="text-muted-foreground">
                Background fills up like water
              </p>
            </div>
            <LucideBarChart3 className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* New Polymorphic Liquid Motion */}
        <div className="bento-card bento-card-sm bg-primary/10 liquid-blob">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">Polymorphic</h3>
              <p className="text-muted-foreground">
                Organic shape transformation
              </p>
            </div>
            <LucideDroplets className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Card with Gradient Animation */}
        <div className="bento-card bento-card-sm bento-liquid-gradient">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">Gradient Flow</h3>
              <p className="text-muted-foreground">
                Smoothly transitioning colors
              </p>
            </div>
            <LucideFileStack className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Card with Float Animation */}
        <div className="bento-card bento-card-sm bento-liquid-float">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2">Floating Card</h3>
              <p className="text-muted-foreground">
                Gently floats up and down
              </p>
            </div>
            <LucideSettings className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Card with Liquid Wave Text */}
        <div className="bento-card bento-card-md">
          <h3 className="text-xl font-semibold mb-2">Wave Text Animation</h3>
          <p className="text-muted-foreground mb-4">
            Characters with staggered wave motion
          </p>
          <div className="text-2xl font-semibold text-primary mt-4">
            {createWaveText("Liquid Wave")}
          </div>
        </div>
        
        {/* Card with Liquid Button Effect */}
        <div className="bento-card bento-card-sm">
          <h3 className="text-xl font-semibold mb-2">Liquid Buttons</h3>
          <p className="text-muted-foreground mb-4">
            Flowing shine effects on hover
          </p>
          <div className="flex gap-2 mt-4">
            <button className="liquid-btn px-4 py-2 rounded-md bg-primary text-white flex items-center">
              <LucideExternalLink className="mr-2 h-4 w-4" />
              Visit
            </button>
            <button className="liquid-btn px-4 py-2 rounded-md border border-primary text-primary flex items-center">
              <LucideRefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Card with Ripple Effect */}
        <div className="bento-card bento-card-md bento-liquid-ripple">
          <h3 className="text-xl font-semibold mb-2">Ripple Animation</h3>
          <p className="text-muted-foreground mb-4">
            Creates expanding ripple effects from the center
          </p>
          <div className="flex items-center mt-4">
            <LucideCheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
            <span>Perfect for interactive elements</span>
          </div>
        </div>
        
        {/* Card with Liquid Drip Effect */}
        <div className="bento-card bento-card-sm">
          <div className="relative flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold mb-2 liquid-drip">Drip Effect</h3>
              <p className="text-muted-foreground">
                Liquid drops falling animation
              </p>
            </div>
            <LucideSend className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        {/* Card with Hover Liquid Effect */}
        <div className="bento-card bento-card-lg bento-hover-liquid">
          <h3 className="text-xl font-semibold mb-2">Hover Liquid Effect</h3>
          <p className="text-muted-foreground mb-4">
            Hover over this card to see the liquid animation appear
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Responsive</h4>
              <p className="text-sm text-muted-foreground">
                Works on all screen sizes
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Interactive</h4>
              <p className="text-sm text-muted-foreground">
                Responds to user input
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Customizable</h4>
              <p className="text-sm text-muted-foreground">
                Adjust colors and timing
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Accessible</h4>
              <p className="text-sm text-muted-foreground">
                Meets a11y standards
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-muted-foreground">
        <p>
          These components use Tailwind classes and custom animations defined in the bento-liquid.css file.
        </p>
      </div>
    </div>
  );
}

export default BentoLiquidExample;