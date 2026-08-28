import React from 'react';
import LoginForm from './components/LoginForm';
import BrandPanel from './components/BrandPanel';

export default function SignUpLoginPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <BrandPanel />

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 min-h-screen">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}