import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ChatProvider } from '../contexts/ChatContext';
import ChatSidebar from '../features/chat/ChatSidebar';

export default function MainLayout() {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture flex flex-col">
        {/* Persistent Navbar across all page transitions */}
        <Navbar />
        
        {/* Page Content Outlet */}
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>

        {/* Chat Sidebar — overlay, accessible from any page */}
        <ChatSidebar />
      </div>
    </ChatProvider>
  );
}
