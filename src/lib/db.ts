import mysql from 'mysql2/promise';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getDbPort() {
  const port = Number.parseInt(process.env.MYSQL_PORT ?? '3306', 10);
  if (Number.isNaN(port)) {
    throw new Error('MYSQL_PORT must be a valid number');
  }
  return port;
}

const useSsl = process.env.MYSQL_SSL === 'true';

const dbConfig: mysql.PoolOptions = {
  host: getRequiredEnv('MYSQL_HOST'),
  port: getDbPort(),
  user: getRequiredEnv('MYSQL_USER'),
  password: getRequiredEnv('MYSQL_PASSWORD'),
  database: getRequiredEnv('MYSQL_DATABASE'),
  ssl: useSsl
    ? {
        rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false'
      }
    : undefined,
  connectTimeout: 60000,
  // 移除无效的配置选项
  multipleStatements: false
};

let pool: mysql.Pool | null = null;
let isInitialized = false;

// 创建连接池（不触发初始化）
function createPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      connectionLimit: 5,
      queueLimit: 0,
      idleTimeout: 300000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

export async function getConnection() {
  const currentPool = createPool();
  
  // 确保数据库已初始化
  if (!isInitialized) {
    await initDatabase();
  }
  
  return currentPool;
}

export async function initDatabase() {
  // 避免重复初始化
  if (isInitialized) {
    return;
  }
  
  // 直接使用连接池，避免递归调用getConnection
  const currentPool = createPool();
  let connection;
  
  try {
    // 获取专用连接进行初始化
    connection = await currentPool.getConnection();
    
    // 禁用外键检查以避免迁移冲突
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // 创建房间表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
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
    
    // 创建用户表（只支持房间模式）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
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
    
    // 创建中奖记录表（只支持房间模式）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS lottery_winners (
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
    
    // 重新启用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    isInitialized = true;
    console.log('Database initialized successfully (room-only mode)');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    // 确保释放连接
    if (connection) {
      connection.release();
    }
  }
}

// 添加连接池健康检查函数
export async function checkDatabaseHealth() {
  try {
    const pool = await getConnection();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function closeDatabaseConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    isInitialized = false;
    console.log('Database connection pool closed');
  }
}

// 数据库类型定义
export interface User {
  id: number;
  room_id: number;
  name: string;
  department?: string;
  created_at: Date;
}

export interface LotteryWinner {
  id: number;
  room_id: number;
  user_id: number;
  round_number: number;
  won_at: Date;
  prize_name?: string;
}

export interface Room {
  id: number;
  room_id: string;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  total_users: number;
  current_winners: number;
} 