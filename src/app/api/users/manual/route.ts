import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// 手动添加单个用户
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
      message: 'User added successfully',
      userId: (result as { insertId: number }).insertId 
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to add user' },
      { status: 500 }
    );
  }
}

// 批量生成序号用户
export async function PUT(request: NextRequest) {
  try {
    const { count, startFrom = 1, roomId } = await request.json();
    
    if (!count || count < 1) {
      return NextResponse.json(
        { error: 'Valid count is required' },
        { status: 400 }
      );
    }
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
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
    
    // 开始事务 - 使用query方法
    await pool.query('START TRANSACTION');
    
    try {
      const addedUsers = [];
      
      for (let i = 0; i < count; i++) {
        const userName = `用户${startFrom + i}`;
        
        // 检查用户是否已存在
        const [existingUser] = await pool.execute(
          'SELECT id FROM users WHERE name = ? AND room_id = ?',
          [userName, room.id]
        );
        
        if (!Array.isArray(existingUser) || existingUser.length === 0) {
          // 用户不存在，添加新用户
          await pool.execute(
            'INSERT INTO users (name, department, room_id) VALUES (?, ?, ?)',
            [userName, '', room.id]
          );
          addedUsers.push(userName);
        }
      }
      
      // 更新房间用户数量
      if (addedUsers.length > 0) {
        await pool.execute(
          'UPDATE rooms SET total_users = total_users + ? WHERE id = ?',
          [addedUsers.length, room.id]
        );
      }
      
      await pool.query('COMMIT');
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully added ${addedUsers.length} users`,
        addedCount: addedUsers.length,
        skippedCount: count - addedUsers.length,
        addedUsers: addedUsers
      });
    } catch (txError) {
      await pool.query('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('Batch add error:', error);
    return NextResponse.json(
      { error: 'Failed to add users' },
      { status: 500 }
    );
  }
} 