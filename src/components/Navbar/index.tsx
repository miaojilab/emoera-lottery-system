'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, Button, Space, App } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import styles from './styles.module.css';
import Image from 'next/image';

interface LocalCreatedRoom {
  roomId: string;
  createdAt: number;
}

// 生成随机房间ID
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 保存房间创建记录到本地存储
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

export function Navbar() {
  const { modal } = App.useApp();
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    {
      key: '/',
      label: '抽奖首页',
    },
    {
      key: '/history',
      label: '历史记录',
    },
  ];

  // 创建新房间
  const createNewRoom = () => {
    modal.confirm({
      title: '创建新房间',
      content: (
        <div>
          <p>确定要创建一个新的抽奖房间吗？</p>
          <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
            <p>• 新房间将生成随机房间号</p>
            <p>• 您可以邀请用户扫码参与抽奖</p>
            <p>• 房间信息将保存到您的历史记录中</p>
          </div>
        </div>
      ),
      okText: '确定创建',
      cancelText: '取消',
      icon: <PlusOutlined style={{ color: '#1890ff' }} />,
      onOk: () => {
        const newRoomId = generateRoomId();
        saveRoomCreationRecord(newRoomId);
        router.push(`/room/${newRoomId}`);
      },
    });
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.logo} onClick={() => router.push('/')}>
          <Image
            src="/choujiang.png"
            alt="E时代抽奖"
            width={32}
            height={32}
            className={styles.logoImage}
            priority
          />
          <span className={styles.logoText}>E时代抽奖</span>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          className={styles.menu}
        />
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={createNewRoom}
            size="small"
          >
            创建新房间
          </Button>
          <Button
            type="link"
            icon={<FileTextOutlined />}
            href="https://docs.qq.com/aio/DVHZpRFFTdUVIYlV2?p=1DpcFCoxfrdnDemGI2ze7F"
            target="_blank"
            className={styles.changelogButton}
          >
            更新日志
          </Button>
        </Space>
      </div>
    </nav>
  );
} 