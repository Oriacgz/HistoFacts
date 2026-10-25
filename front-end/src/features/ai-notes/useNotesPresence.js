import {useEffect, useRef, useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {apiFetch} from '../../api/client';

export default function useNotesPresence() {
  const {user} = useAuth();
  const userId = user?.id;
  const [tabId] = useState(()=>crypto.randomUUID());
  const queue = useRef(Promise.resolve());

  useEffect(()=>{
    if (!userId) return;
    // Serialize heartbeats and release so a late heartbeat cannot undo leaving.
    const publish = active => {
      queue.current = queue.current.then(()=>apiFetch('/api/notifications/notes-presence', {
        method:'POST', body:JSON.stringify({tab_id:tabId, active}),
        expectedUserId:userId, keepalive:true,
      })).catch(()=>{});
    };
    const visible = ()=>document.visibilityState==='visible' && document.hasFocus();
    const update = ()=>publish(visible());
    const leave = ()=>publish(false);
    update();
    const heartbeat = setInterval(()=>{if (visible()) publish(true);},15000);
    document.addEventListener('visibilitychange',update);
    window.addEventListener('focus',update);
    window.addEventListener('blur',leave);
    window.addEventListener('pagehide',leave);
    window.addEventListener('pageshow',update);
    return ()=>{
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange',update);
      window.removeEventListener('focus',update);
      window.removeEventListener('blur',leave);
      window.removeEventListener('pagehide',leave);
      window.removeEventListener('pageshow',update);
      leave();
    };
  },[userId,tabId]);
}
