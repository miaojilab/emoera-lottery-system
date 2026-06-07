'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

// 生成随机房间ID
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface LocalCreatedRoom {
  roomId: string;
  createdAt: number;
}

// 保存房间创建记录到本地存储（只保存房间ID和创建时间）
function saveRoomCreationRecord(roomId: string) {
  try {
    const existingRooms: LocalCreatedRoom[] = JSON.parse(localStorage.getItem('myCreatedRooms') || '[]');
    
    // 检查是否已存在
    const exists = existingRooms.some((room: LocalCreatedRoom) => room.roomId === roomId);
    if (!exists) {
      const newRoom: LocalCreatedRoom = {
        roomId: roomId,
        createdAt: Date.now(),
      };
      
      const updatedRooms = [newRoom, ...existingRooms].slice(0, 50); // 保留最近50个房间
      localStorage.setItem('myCreatedRooms', JSON.stringify(updatedRooms));
    }
  } catch (error) {
    console.error('Failed to save room creation record:', error);
  }
}

// 获取最近创建的房间
function getLatestRoom(): string | null {
  try {
    const existingRooms: LocalCreatedRoom[] = JSON.parse(localStorage.getItem('myCreatedRooms') || '[]');
    if (existingRooms.length > 0) {
      // 按创建时间排序，返回最近的房间ID
      const sortedRooms = existingRooms.sort((a, b) => b.createdAt - a.createdAt);
      return sortedRooms[0].roomId;
    }
    return null;
  } catch (error) {
    console.error('Failed to get latest room:', error);
    return null;
  }
}

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 检查是否有已创建的房间
    const latestRoomId = getLatestRoom();
    
    if (latestRoomId) {
      // 如果有房间，进入最近创建的房间
      router.replace(`/room/${latestRoomId}`);
    } else {
      // 如果没有房间，创建新房间
      const newRoomId = generateRoomId();
      
      // 记录房间创建
      saveRoomCreationRecord(newRoomId);
      
      router.replace(`/room/${newRoomId}`);
    }
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column'
    }}>
      <Spin size="large" />
      <p style={{ marginTop: 16 }}>正在进入抽奖房间...</p>
    </div>
  );
}
