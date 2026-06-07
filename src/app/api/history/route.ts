import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const roomIds = searchParams.get('roomIds'); // 支持批量查询房间ID
    const type = searchParams.get('type') || 'all'; // 'lottery', 'rooms', 'all'
    
    const pool = await getConnection();
    const result: {
      lotteryRecords?: unknown;
      roomRecords?: unknown;
    } = {};
    
    if (type === 'lottery' || type === 'all') {
      // 获取抽奖历史记录
      if (roomId) {
        // 获取指定房间的抽奖记录
        const [lotteryRecords] = await pool.execute(`
          SELECT 
            lw.id,
            lw.round_number,
            lw.won_at,
            lw.prize_name,
            u.name as winner_name,
            u.department as winner_department,
            r.room_id,
            r.name as room_name
          FROM lottery_winners lw
          JOIN users u ON lw.user_id = u.id
          JOIN rooms r ON lw.room_id = r.id
          WHERE r.room_id = ?
          ORDER BY lw.won_at DESC, lw.round_number DESC
        `, [roomId]);
        
        result.lotteryRecords = lotteryRecords;
      } else if (roomIds) {
        // 获取指定房间列表的抽奖记录
        try {
          const roomIdList = JSON.parse(roomIds);
          if (Array.isArray(roomIdList) && roomIdList.length > 0) {
            const placeholders = roomIdList.map(() => '?').join(',');
            const [lotteryRecords] = await pool.execute(`
              SELECT 
                lw.id,
                lw.round_number,
                lw.won_at,
                lw.prize_name,
                u.name as winner_name,
                u.department as winner_department,
                r.room_id,
                r.name as room_name
              FROM lottery_winners lw
              JOIN users u ON lw.user_id = u.id
              JOIN rooms r ON lw.room_id = r.id
              WHERE r.room_id IN (${placeholders})
              ORDER BY lw.won_at DESC, lw.round_number DESC
            `, roomIdList);
            
            result.lotteryRecords = lotteryRecords;
          }
        } catch (error) {
          console.error('Invalid roomIds format for lottery records:', error);
        }
      } else {
        // 获取所有房间的抽奖记录汇总（保留原逻辑以防万一）
        const [lotteryRecords] = await pool.execute(`
          SELECT 
            lw.round_number,
            lw.won_at,
            lw.prize_name,
            COUNT(*) as winner_count,
            r.room_id,
            r.name as room_name,
            GROUP_CONCAT(CONCAT(u.name, '(', COALESCE(u.department, ''), ')') SEPARATOR ', ') as winners
          FROM lottery_winners lw
          JOIN users u ON lw.user_id = u.id
          JOIN rooms r ON lw.room_id = r.id
          GROUP BY lw.room_id, lw.round_number, lw.won_at, lw.prize_name, r.room_id, r.name
          ORDER BY lw.won_at DESC, lw.round_number DESC
          LIMIT 100
        `);
        
        result.lotteryRecords = lotteryRecords;
      }
    }
    
    if (type === 'rooms' || type === 'all') {
      // 获取房间创建记录
      let roomQuery = `
        SELECT 
          r.room_id,
          r.name,
          r.description,
          r.created_at,
          r.total_users,
          r.current_winners,
          COUNT(DISTINCT lw.round_number) as total_rounds
        FROM rooms r
        LEFT JOIN lottery_winners lw ON r.id = lw.room_id
      `;
      
      let queryParams: string[] = [];
      
      if (roomId) {
        roomQuery += ' WHERE r.room_id = ?';
        queryParams = [roomId];
      } else if (roomIds) {
        // 支持批量查询房间ID
        try {
          const roomIdList = JSON.parse(roomIds);
          if (Array.isArray(roomIdList) && roomIdList.length > 0) {
            const placeholders = roomIdList.map(() => '?').join(',');
            roomQuery += ` WHERE r.room_id IN (${placeholders})`;
            queryParams = roomIdList;
          }
        } catch (error) {
          console.error('Invalid roomIds format:', error);
        }
      }
      
      roomQuery += `
        GROUP BY r.id, r.room_id, r.name, r.description, r.created_at, r.total_users, r.current_winners
        ORDER BY r.created_at DESC
      `;
      
      if (!roomId && !roomIds) {
        roomQuery += ' LIMIT 50';
      }
      
      const [roomRecords] = await pool.execute(roomQuery, queryParams);
      
      result.roomRecords = roomRecords;
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
} 