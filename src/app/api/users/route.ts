import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// 获取用户列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 首先获取房间信息
    const [roomCheck] = await pool.execute(
      'SELECT id FROM rooms WHERE room_id = ?',
      [roomId]
    );
    
    if (!Array.isArray(roomCheck) || roomCheck.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    const room = roomCheck[0] as { id: number };
    
    // 获取房间内的用户列表，包含参与状态
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.department, u.created_at,
       CASE WHEN lw.user_id IS NOT NULL THEN true ELSE false END as participated
       FROM users u
       LEFT JOIN lottery_winners lw ON u.id = lw.user_id
       WHERE u.room_id = ?
       ORDER BY u.created_at DESC`,
      [room.id]
    );
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// 添加用户
export async function POST(request: NextRequest) {
  try {
    const { name, department, roomId } = await request.json();
    
    if (!name || !roomId) {
      return NextResponse.json(
        { error: 'name and roomId are required' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 检查房间是否存在
    const [roomCheck] = await pool.execute(
      'SELECT id FROM rooms WHERE room_id = ?',
      [roomId]
    );
    
    if (!Array.isArray(roomCheck) || roomCheck.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    const room = roomCheck[0] as { id: number };
    
    // 检查用户在该房间是否已存在
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE name = ? AND room_id = ?',
      [name.trim(), room.id]
    );
    
    if (Array.isArray(existingUser) && existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User already registered in this room' },
        { status: 409 }
      );
    }
    
    // 插入新用户
    const [result] = await pool.execute(
      'INSERT INTO users (name, department, room_id) VALUES (?, ?, ?)',
      [name.trim(), department?.trim() || null, room.id]
    );
    
    // 更新房间用户数量
    await pool.execute(
      'UPDATE rooms SET total_users = total_users + 1 WHERE id = ?',
      [room.id]
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'User registered successfully',
      userId: (result as { insertId: number }).insertId 
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// 删除用户
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roomId = searchParams.get('roomId');
    
    if (!userId || !roomId) {
      return NextResponse.json(
        { error: 'userId and roomId are required' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 获取房间信息
    const [roomCheck] = await pool.execute(
      'SELECT id FROM rooms WHERE room_id = ?',
      [roomId]
    );
    
    if (!Array.isArray(roomCheck) || roomCheck.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    const room = roomCheck[0] as { id: number };
    
    // 删除用户
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ? AND room_id = ?',
      [parseInt(userId), room.id]
    );
    
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return NextResponse.json(
        { error: 'User not found in this room' },
        { status: 404 }
      );
    }
    
    // 更新房间用户数量
    await pool.execute(
      'UPDATE rooms SET total_users = total_users - 1 WHERE id = ?',
      [room.id]
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
} 