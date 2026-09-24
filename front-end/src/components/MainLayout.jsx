import { Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import Navbar from './Navbar';
import { ChatProvider } from '../contexts/ChatContext';
import ChatSidebar from '../features/chat/ChatSidebar';

export default function MainLayout() {
  const location = useLocation();
  const isNotes = location.pathname.startsWith('/notes');

  return (
    <ChatProvider>
      <div
        className={`bg-histo-paper text-histo-ink font-body histo-paper-texture flex flex-col ${
          isNotes ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen'
        }`}
      >
        {/* Persistent Navbar across all page transitions */}
        <Navbar />

        {/* Page Content Outlet - natural scrolling for feed/home, constrained for notes */}
        <div className={`flex-1 flex flex-col ${isNotes ? 'min-h-0 overflow-hidden' : ''}`}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>

        {/* Chat Sidebar — overlay, accessible from any page */}
        <ChatSidebar />
      </div>
    </ChatProvider>
  );
}
