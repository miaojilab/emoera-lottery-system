import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// 创建或获取房间
export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        { error: 'Valid room ID is required' },
        { status: 400 }
      );
    }

    const pool = await getConnection();
    
    // 检查房间是否已存在
    const [existing] = await pool.execute(
      'SELECT id, name, description, total_users, current_winners FROM rooms WHERE room_id = ?',
      [roomId]
    );
    
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ 
        room: existing[0],
        message: 'Room already exists' 
      });
    }
    
    // 创建新房间
    const roomName = `抽奖房间 ${roomId.toUpperCase()}`;
    const description = `房间ID: ${roomId}，欢迎参与抽奖！`;
    
    const [result] = await pool.execute(
      'INSERT INTO rooms (room_id, name, description) VALUES (?, ?, ?)',
      [roomId, roomName, description]
    );
    
    const newRoom = {
      id: (result as { insertId: number }).insertId,
      room_id: roomId,
      name: roomName,
      description: description,
      total_users: 0,
      current_winners: 0
    };
    
    return NextResponse.json({ 
      room: newRoom,
      message: 'Room created successfully' 
    });
  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 获取房间列表
export async function GET() {
  try {
    const pool = await getConnection();
    
    const [rooms] = await pool.execute(`
      SELECT 
        r.*,
        COUNT(u.id) as total_users,
        COUNT(CASE WHEN u.participated = TRUE THEN 1 END) as current_winners
      FROM rooms r
      LEFT JOIN users u ON r.id = u.room_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);
    
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Fetch rooms error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
} 