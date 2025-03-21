/**
 * Simple Color Picker Component
 * A lightweight color picker component using react-colorful
 */
import { useState, useEffect, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Ensure color is a valid hex color with # prefix
  const safeColor = color.startsWith('#') ? color : `#${color}`;
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-8 h-8 rounded border border-gray-300 shadow-sm"
          style={{ backgroundColor: safeColor }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Select color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" ref={popoverRef}>
        <HexColorPicker color={safeColor} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}