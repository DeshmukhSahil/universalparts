// components/AnnouncementBar.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let mounted = true;

    const fetchAnns = async () => {
      try {
        const { data } = await axios.get('https://universalparts.onrender.com/api/announcements');
        if (mounted) setAnnouncements(data);
      } catch (err) { console.error(err); }
    };

    fetchAnns();

    // Setup socket only once
    const socket = io(undefined, { path: '/socket.io' }); // default; provide url if needed

    socket.on('connect', () => console.log('socket connected for announcements'));
    socket.on('announcement:new', (ann) => {
      setAnnouncements(prev => [ann, ...prev].sort((a,b) => (b.pinned - a.pinned) || (new Date(b.createdAt) - new Date(a.createdAt))));
    });
    socket.on('announcement:update', (ann) => {
      setAnnouncements(prev => {
        const filtered = prev.filter(x => x._id !== ann._id);
        return [ann, ...filtered].sort((a,b) => (b.pinned - a.pinned) || (new Date(b.createdAt) - new Date(a.createdAt)));
      });
    });
    socket.on('announcement:delete', ({ id }) => {
      setAnnouncements(prev => prev.filter(x => x._id !== id));
    });

    return () => { mounted = false; socket.disconnect(); };
  }, []);

  if (!announcements.length) return null;

  // display first pinned or most recent announcement as a bar
  const top = announcements[0];

  return (
    <div style={{
      width: '100%', padding: '8px 16px', background: '#fff7cc',
      borderBottom: '1px solid #f0e6b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <strong style={{ marginRight: 8 }}>{top.title}</strong>
        <span dangerouslySetInnerHTML={{ __html: top.message }} /> {/* sanitize server-side if allowing HTML */}
      </div>
      <div style={{ fontSize: 12, opacity: .8 }}>
        {top.pinned && <span style={{ marginRight: 8 }}>📌 Pinned</span>}
        <span>{new Date(top.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
