import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { confirm } = await request.json();
    
    if (confirm !== 'RESET_DATABASE') {
      return NextResponse.json(
        { error: 'Invalid confirmation' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    try {
      // 禁用外键检查 - 使用query方法
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // 删除现有表
      await pool.execute('DROP TABLE IF EXISTS lottery_winners');
      await pool.execute('DROP TABLE IF EXISTS users');
      await pool.execute('DROP TABLE IF EXISTS rooms');
      
      // 创建房间表
      await pool.execute(`
        CREATE TABLE rooms (
          id INT AUTO_INCREMENT PRIMARY KEY,
          room_id VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(200) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          total_users INT DEFAULT 0,
          current_winners INT DEFAULT 0,
          INDEX idx_room_id (room_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 创建用户表
      await pool.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          room_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          department VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_room_id (room_id),
          INDEX idx_name (name),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 创建中奖记录表
      await pool.execute(`
        CREATE TABLE lottery_winners (
          id INT AUTO_INCREMENT PRIMARY KEY,
          room_id INT NOT NULL,
          user_id INT NOT NULL,
          round_number INT NOT NULL,
          won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          prize_name VARCHAR(200),
          INDEX idx_room_id (room_id),
          INDEX idx_round (round_number),
          INDEX idx_won_at (won_at),
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 重新启用外键检查 - 使用query方法
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      
      console.log('Database reset completed successfully (room-only mode)');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Database reset successfully (room-only mode)' 
      });
    } catch (error) {
      console.error('Database reset error:', error);
      return NextResponse.json(
        { error: 'Failed to reset database', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 