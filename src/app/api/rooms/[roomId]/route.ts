import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const pool = await getConnection();
    
    // 获取房间信息
    const [roomRows] = await pool.execute(
      'SELECT * FROM rooms WHERE room_id = ?',
      [roomId]
    );
    
    if (!Array.isArray(roomRows) || roomRows.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    const room = roomRows[0];
    
    // 获取房间用户数量
    const [userCountRows] = await pool.execute(
      'SELECT COUNT(*) as total_users FROM users WHERE room_id = (SELECT id FROM rooms WHERE room_id = ?)',
      [roomId]
    );
    
    const userCount = Array.isArray(userCountRows) && userCountRows.length > 0 
      ? (userCountRows[0] as { total_users: number }).total_users 
      : 0;
    
    // 获取房间中奖者数量
    const [winnerCountRows] = await pool.execute(
      'SELECT COUNT(*) as current_winners FROM lottery_winners WHERE room_id = (SELECT id FROM rooms WHERE room_id = ?)',
      [roomId]
    );
    
    const winnerCount = Array.isArray(winnerCountRows) && winnerCountRows.length > 0 
      ? (winnerCountRows[0] as { current_winners: number }).current_winners 
      : 0;
    
    // 更新统计信息
    const roomWithStats = {
      ...room,
      total_users: userCount,
      current_winners: winnerCount
    };
    
    return NextResponse.json({ room: roomWithStats });
  } catch (error) {
    console.error('Room fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 