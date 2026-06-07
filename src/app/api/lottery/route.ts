import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { count = 1, roomId, prizeName, preventDuplicateWinners = true } = await request.json();
    
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
    
    // 获取房间内可参与的用户
    let usersQuery = '';
    let queryParams = [];
    
    if (preventDuplicateWinners) {
      // 排除已中奖的用户
      usersQuery = `
        SELECT u.id, u.name, u.department 
        FROM users u 
        LEFT JOIN lottery_winners lw ON u.id = lw.user_id 
        WHERE u.room_id = ? AND lw.user_id IS NULL
      `;
      queryParams = [room.id];
    } else {
      // 获取所有用户
      usersQuery = 'SELECT id, name, department FROM users WHERE room_id = ?';
      queryParams = [room.id];
    }
    
    const [users] = await pool.execute(usersQuery, queryParams);
    
    if (!Array.isArray(users) || users.length === 0) {
      const errorMessage = preventDuplicateWinners 
        ? 'No available users found in this room (all users have already won)'
        : 'No users found in this room';
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }
    
    if (users.length < count) {
      return NextResponse.json(
        { error: `Only ${users.length} users available, but ${count} requested` },
        { status: 400 }
      );
    }
    
    // 随机选择用户
    const shuffled = [...users].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, count);
    
    // 获取当前轮次编号（基于房间）
    const [roundResult] = await pool.execute(
      'SELECT COALESCE(MAX(round_number), 0) + 1 as next_round FROM lottery_winners WHERE room_id = ?',
      [room.id]
    );
    const roundNumber = Array.isArray(roundResult) && roundResult.length > 0 ? 
      (roundResult[0] as { next_round: number }).next_round : 1;
    
    // 开始事务 - 使用query方法而不是execute
    await pool.query('START TRANSACTION');
    
    try {
      // 记录中奖信息（房间模式）
      for (const winner of winners) {
        await pool.execute(
          'INSERT INTO lottery_winners (room_id, user_id, round_number, prize_name) VALUES (?, ?, ?, ?)',
          [room.id, (winner as { id: number }).id, roundNumber, prizeName || null]
        );
      }
      
      // 更新房间的中奖人数统计
      await pool.execute(
        'UPDATE rooms SET current_winners = current_winners + ? WHERE id = ?',
        [winners.length, room.id]
      );
      
      await pool.query('COMMIT');
      
      return NextResponse.json({ 
        success: true, 
        roundNumber,
        winners: (winners as { id: number; name: string; department?: string }[]).map(w => ({
          id: w.id,
          name: w.name,
          department: w.department
        }))
      });
    } catch (txError) {
      await pool.query('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('Lottery error:', error);
    return NextResponse.json(
      { error: 'Failed to conduct lottery' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    
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
    
    // 开始事务 - 使用query方法而不是execute
    await pool.query('START TRANSACTION');
    
    try {
      // 删除该房间的中奖记录
      await pool.execute(
        'DELETE FROM lottery_winners WHERE room_id = ?',
        [room.id]
      );
      
      // 重置房间的中奖人数统计
      await pool.execute(
        'UPDATE rooms SET current_winners = 0 WHERE id = ?',
        [room.id]
      );
      
      await pool.query('COMMIT');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Room reset successfully' 
      });
    } catch (txError) {
      await pool.query('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset' },
      { status: 500 }
    );
  }
} 