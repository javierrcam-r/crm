'use client';

import Sidebar from './Sidebar';
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-dark-800">
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 pt-16 md:pt-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <FloatingChatWidget />
    </div>
  );
}
