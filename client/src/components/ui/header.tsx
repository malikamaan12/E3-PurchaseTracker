import React from 'react';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="bg-primary text-white py-6 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm md:text-base opacity-90">{description}</p>
        )}
      </div>
    </div>
  );
}