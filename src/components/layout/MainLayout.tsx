'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const fullWidth = pathname === '/calendario';

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-dark-800">
      <Sidebar />
      <main
        className={cn(
          'min-h-screen transition-[margin] duration-300',
          collapsed ? 'md:ml-[72px]' : 'md:ml-64',
        )}
      >
        <div
          className={cn(
            'p-4 pt-16 md:pt-4',
            fullWidth ? 'md:p-4 lg:px-5' : 'md:p-6 lg:p-8 max-w-7xl mx-auto',
          )}
        >
          {children}
        </div>
      </main>
      <FloatingChatWidget />
    </div>
  );
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
