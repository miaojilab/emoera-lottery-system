'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card, InputNumber, Form, Input, Table, Typography, App, Space, Tooltip, Modal, Row, Col, Switch, Tag } from 'antd';
import { PlusOutlined, NumberOutlined, ClearOutlined, ReloadOutlined, SyncOutlined, PauseOutlined, HistoryOutlined } from '@ant-design/icons';
import styles from './page.module.css';
import { useRouter, useParams } from 'next/navigation';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import confetti from 'canvas-confetti';

interface User {
  key: string;
  name: string;
  department: string;
}

interface DatabaseUser {
  id: number;
  name: string;
  department?: string;
  created_at: Date;
  participated: boolean;
}

interface LotteryWinnerResponse {
  id: number;
  name: string;
  department?: string;
}

export default function RoomPage() {
  const { modal } = App.useApp();
  const [isSpinning, setIsSpinning] = useState(false);
  const [databaseUsers, setDatabaseUsers] = useState<DatabaseUser[]>([]);
  const [currentWinners, setCurrentWinners] = useState<User[]>([]);
  const [allWinners, setAllWinners] = useState<User[]>([]);
  const [drawCount, setDrawCount] = useState<number>(1);
  const [preventDuplicateWinners, setPreventDuplicateWinners] = useState(true);
  const [form] = Form.useForm();
  const [generateForm] = Form.useForm();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [roomInfo, setRoomInfo] = useState<{ name: string; total_users: number; current_winners: number } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [winnerModalVisible, setWinnerModalVisible] = useState(false);
  const [modalWinners, setModalWinners] = useState<User[]>([]);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [generateUsersLoading, setGenerateUsersLoading] = useState(false);

  const databaseColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (text: string) => text || '-'
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '中奖状态',
      dataIndex: 'participated',
      key: 'participated',
      render: (participated: boolean) => participated ? '已中奖' : '未中奖'
    },
  ];

  const winnersColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (text: string) => text || '-'
    },
  ];

  // 获取或创建房间
  const fetchOrCreateRoom = async () => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoomInfo({
          name: data.room.name,
          total_users: data.room.total_users || 0,
          current_winners: data.room.current_winners || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    }
  };

  // 生成二维码URL
  useEffect(() => {
    if (typeof window !== 'undefined' && roomId) {
      const baseUrl = window.location.origin;
      setQrCodeUrl(`${baseUrl}/register?roomId=${roomId}`);
    }
  }, [roomId]);

  // 从localStorage恢复状态
  useEffect(() => {
    if (roomId) {
      try {
        // 恢复中奖名单状态
        const savedCurrentWinners = localStorage.getItem(`currentWinners_${roomId}`);
        const savedAllWinners = localStorage.getItem(`allWinners_${roomId}`);
        const savedPreventDuplicate = localStorage.getItem(`preventDuplicateWinners_${roomId}`);
        
        if (savedCurrentWinners) {
          const currentWinnersData = JSON.parse(savedCurrentWinners);
          setCurrentWinners(currentWinnersData);
        }
        
        if (savedAllWinners) {
          const allWinnersData = JSON.parse(savedAllWinners);
          // 为旧数据添加唯一key（如果key中没有轮次信息）
          const migratedData = allWinnersData.map((winner: User, index: number) => {
            if (!winner.key.includes('-round')) {
              return {
                ...winner,
                key: `${winner.key}-legacy-${index}`
              };
            }
            return winner;
          });
          setAllWinners(migratedData);
        }
        
        if (savedPreventDuplicate !== null) {
          setPreventDuplicateWinners(JSON.parse(savedPreventDuplicate));
        }
      } catch (error) {
        console.error('Failed to restore state from localStorage:', error);
      }
    }
  }, [roomId]);

  // 初始化
  useEffect(() => {
    if (roomId) {
      fetchOrCreateRoom();
      fetchDatabaseUsers();
    }
  }, [roomId]);

  // 自动刷新功能
  useEffect(() => {
    if (autoRefresh && roomId) {
      refreshIntervalRef.current = setInterval(() => {
        refreshAllData();
      }, 5000); // 每5秒刷新一次

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [autoRefresh, roomId]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // 当preventDuplicateWinners变化时保存到localStorage
  useEffect(() => {
    if (roomId) {
      saveStateToLocalStorage(currentWinners, allWinners, preventDuplicateWinners);
    }
  }, [preventDuplicateWinners, roomId]);

  // 获取数据库用户
  const fetchDatabaseUsers = async () => {
    try {
      const response = await fetch(`/api/users?roomId=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setDatabaseUsers(data.users || []);
        setLastRefreshTime(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch database users:', error);
    }
  };

  // 刷新所有数据
  const refreshAllData = async () => {
    await Promise.all([
      fetchOrCreateRoom(),
      fetchDatabaseUsers()
    ]);
  };

  // 切换自动刷新
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const onAddUser = async (values: { name: string; department?: string }) => {
    setAddUserLoading(true);
    try {
      const response = await fetch('/api/users/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          roomId: roomId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        modal.success({
          title: '添加成功',
          content: `用户 "${values.name}" 已添加到抽奖房间`
        });
        form.resetFields();
        fetchDatabaseUsers();
        fetchOrCreateRoom();
      } else {
        modal.error({
          title: '添加失败',
          content: data.error || '添加用户失败'
        });
      }
    } catch (error) {
      console.error('Add user error:', error);
      modal.error({
        title: '添加失败',
        content: '网络错误，请重试'
      });
    } finally {
      setAddUserLoading(false);
    }
  };

  const generateSequentialUsers = async (values: { count: number; startFrom?: number }) => {
    setGenerateUsersLoading(true);
    try {
      const response = await fetch('/api/users/manual', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          roomId: roomId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        modal.success({
          title: '批量生成成功',
          content: `生成了 ${data.addedCount} 个序号用户${data.skippedCount > 0 ? `（跳过了 ${data.skippedCount} 个已存在的用户）` : ''}`
        });
        generateForm.resetFields();
        fetchDatabaseUsers();
        fetchOrCreateRoom();
      } else {
        modal.error({
          title: '生成失败',
          content: data.error || '批量生成用户失败'
        });
      }
    } catch (error) {
      console.error('Generate users error:', error);
      modal.error({
        title: '生成失败',
        content: '网络错误，请重试'
      });
    } finally {
      setGenerateUsersLoading(false);
    }
  };

  const showDrawConfirm = () => {
    const currentUsers = databaseUsers.map(u => ({
      key: u.id.toString(),
      name: u.name,
      department: u.department || ''
    }));

    // 使用与getCurrentAvailableCount相同的逻辑计算可用用户
    const availableUsersCount = getCurrentAvailableCount();
    const availableUsers = preventDuplicateWinners 
      ? databaseUsers.filter(user => !user.participated)
      : databaseUsers;

    if (currentUsers.length === 0) {
      modal.warning({
        title: '提示',
        content: '当前房间还没有用户报名',
      });
      return;
    }

    if (availableUsersCount === 0) {
      modal.warning({
        title: '提示',
        content: '没有可参与抽奖的用户了',
      });
      return;
    }

    if (drawCount > availableUsersCount) {
      modal.warning({
        title: '提示',
        content: `当前只有 ${availableUsersCount} 人可以参与抽奖`,
      });
      return;
    }

    modal.confirm({
      title: '确认抽奖',
      content: (
        <div>
          <p>即将开始抽奖，请确认以下信息：</p>
          <ul style={{ marginLeft: 20, marginTop: 16 }}>
            <li>本次抽取人数：{drawCount} 人</li>
            <li>当前可参与人数：{availableUsersCount} 人</li>
            <li>重复中奖：{preventDuplicateWinners ? '禁止' : '允许'}</li>
          </ul>
        </div>
      ),
      onOk: drawPrize,
      okText: '开始抽奖',
      cancelText: '取消',
      width: 500,
    });
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }, 300);
  };

  const drawPrize = async () => {
    setIsSpinning(true);
    
    try {
      const response = await fetch('/api/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          count: drawCount,
          roomId: roomId,
          preventDuplicateWinners: preventDuplicateWinners
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const winners = data.winners.map((w: LotteryWinnerResponse) => ({
          key: w.id.toString(),
          name: w.name,
          department: w.department || ''
        }));
        
        setTimeout(() => {
          const newCurrentWinners = winners;
          // 为每个中奖者生成唯一的key，包含轮次信息
          const winnersWithUniqueKeys = winners.map((winner: User, index: number) => ({
            ...winner,
            key: `${winner.key}-round${data.roundNumber}-${index}`
          }));
          const newAllWinners = [...allWinners, ...winnersWithUniqueKeys];
          
          setCurrentWinners(newCurrentWinners);
          setAllWinners(newAllWinners);
          setModalWinners(winners);
          setWinnerModalVisible(true);
          fireConfetti();
          setIsSpinning(false);
          
          // 保存状态到localStorage
          saveStateToLocalStorage(newCurrentWinners, newAllWinners, preventDuplicateWinners);
          
          // 保存到本地历史记录
          saveToLocalHistory(winners, data.roundNumber);
          
          fetchDatabaseUsers();
          fetchOrCreateRoom();
        }, 800);
      } else {
        const errorData = await response.json();
        modal.error({
          title: '抽奖失败',
          content: errorData.error || '服务器错误'
        });
        setIsSpinning(false);
      }
    } catch (error) {
      console.error('Draw error:', error);
      modal.error({
        title: '抽奖失败',
        content: '网络错误，请重试'
      });
      setIsSpinning(false);
    }
  };

  const resetDatabaseUsers = async () => {
    modal.confirm({
      title: '确认重置',
      content: '确定要重置该房间所有用户的参与状态吗？重置后所有用户都可以重新参与抽奖。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/lottery', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomId: roomId }),
          });
          
          if (response.ok) {
            modal.success({
              title: '重置成功',
              content: '所有用户的参与状态已重置'
            });
            fetchDatabaseUsers();
            setCurrentWinners([]);
            setAllWinners([]);
          } else {
            modal.error({
              title: '重置失败',
              content: '服务器错误，请重试'
            });
          }
        } catch (error) {
          console.error('Reset error:', error);
          modal.error({
            title: '重置失败',
            content: '网络错误，请重试'
          });
        }
      },
    });
  };

  const getCurrentUsers = () => {
    return databaseUsers.map(u => ({
      key: u.id.toString(),
      name: u.name,
      department: u.department || ''
    }));
  };

  const getCurrentAvailableCount = () => {
    // 基于数据库用户数据计算可参与人数
    if (preventDuplicateWinners) {
      // 如果启用了防重复中奖，则返回未中奖的用户数
      return databaseUsers.filter(user => !user.participated).length;
    } else {
      // 如果允许重复中奖，则返回所有用户数
      return databaseUsers.length;
    }
  };

  // 保存状态到localStorage
  const saveStateToLocalStorage = (currentWinners: User[], allWinners: User[], preventDuplicate: boolean) => {
    try {
      localStorage.setItem(`currentWinners_${roomId}`, JSON.stringify(currentWinners));
      localStorage.setItem(`allWinners_${roomId}`, JSON.stringify(allWinners));
      localStorage.setItem(`preventDuplicateWinners_${roomId}`, JSON.stringify(preventDuplicate));
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  };

  const clearWinners = () => {
    modal.confirm({
      title: '确认清空',
      content: '确定要清空所有中奖记录吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setCurrentWinners([]);
        setAllWinners([]);
        // 清空localStorage
        saveStateToLocalStorage([], [], preventDuplicateWinners);
      },
    });
  };

  // 保存到本地历史记录
  const saveToLocalHistory = (winners: User[], roundNumber: number) => {
    try {
      const existingRecords = JSON.parse(localStorage.getItem('lotteryRecords') || '[]');
      const newRecord = {
        id: `${roomId}-${roundNumber}-${Date.now()}`,
        timestamp: Date.now(),
        drawCount: winners.length,
        winners: winners,
        roomId: roomId,
        roomName: roomInfo?.name || `房间 ${roomId}`,
        roundNumber: roundNumber,
      };
      
      const updatedRecords = [newRecord, ...existingRecords].slice(0, 100); // 保留最近100条记录
      localStorage.setItem('lotteryRecords', JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('Failed to save to local history:', error);
    }
  };

  return (
    <main style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ display: 'flex', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ flex: 1 }}>
          <Row gutter={[16, 16]}>
            {roomInfo && (
              <Col span={24}>
                <Card 
                  title={`房间 ${roomId}`} 
                  size="small"
                  extra={
                    <Space>
                      <Button
                        icon={<HistoryOutlined />}
                        size="small"
                        onClick={() => router.push(`/history?roomId=${roomId}`)}
                      >
                        历史记录
                      </Button>
                      <Button
                        icon={autoRefresh ? <PauseOutlined /> : <SyncOutlined />}
                        type={autoRefresh ? "default" : "primary"}
                        size="small"
                        onClick={toggleAutoRefresh}
                      >
                        {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        size="small"
                        onClick={refreshAllData}
                      >
                        立即刷新
                      </Button>
                    </Space>
                  }
                >
                  <Typography.Text type="secondary">
                    {roomInfo.name}
                  </Typography.Text>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                      报名人数：<span style={{ fontWeight: 'bold', color: '#1890ff' }}>{roomInfo.total_users}</span> | 已中奖：<span style={{ fontWeight: 'bold', color: '#52c41a' }}>{roomInfo.current_winners}</span>
                    </Typography.Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {autoRefresh && (
                        <Tag color="green" icon={<SyncOutlined spin />}>
                          自动刷新中
                        </Tag>
                      )}
                      {lastRefreshTime && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                          最后更新：{lastRefreshTime.toLocaleTimeString()}
                        </Typography.Text>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            )}
            <Col span={24}>
              <QRCodeGenerator 
                url={qrCodeUrl}
                title={`房间 ${roomId} - 扫码参与`}
                description="用户扫码后可填写信息参与抽奖"
              />
            </Col>
            <Col span={24}>
              <Card 
                title="参与者管理"
                extra={
                  <Space>
                    <Button 
                      icon={<ReloadOutlined />} 
                      onClick={refreshAllData}
                      type="default"
                    >
                      刷新
                    </Button>
                    <Button 
                      icon={<ClearOutlined />} 
                      onClick={resetDatabaseUsers}
                      danger
                    >
                      重置状态
                    </Button>
                  </Space>
                }
              >
                <div style={{ marginBottom: 16 }}>
                  <Form form={form} onFinish={onAddUser} layout="inline" style={{ marginBottom: 16 }}>
                    <Form.Item
                      name="name"
                      rules={[{ required: true, message: '请输入姓名' }]}
                    >
                      <Input placeholder="姓名" />
                    </Form.Item>
                    <Form.Item name="department">
                      <Input placeholder="部门（选填）" />
                    </Form.Item>
                    <Form.Item>
                      <Button 
                        type="primary" 
                        htmlType="submit" 
                        icon={<PlusOutlined />}
                        loading={addUserLoading}
                      >
                        添加
                      </Button>
                    </Form.Item>
                  </Form>

                  <Form 
                    form={generateForm} 
                    onFinish={generateSequentialUsers} 
                    layout="inline"
                    initialValues={{ startFrom: 1 }}
                  >
                    <Form.Item
                      name="count"
                      rules={[{ required: true, message: '请输入数量' }]}
                    >
                      <InputNumber 
                        min={1} 
                        placeholder="生成数量" 
                      />
                    </Form.Item>
                    <Form.Item name="startFrom">
                      <InputNumber 
                        min={1} 
                        placeholder="起始号码" 
                      />
                    </Form.Item>
                    <Form.Item>
                      <Tooltip title="批量生成序号">
                        <Button 
                          type="default" 
                          htmlType="submit" 
                          icon={<NumberOutlined />}
                          loading={generateUsersLoading}
                        >
                          生成序号
                        </Button>
                      </Tooltip>
                    </Form.Item>
                  </Form>
                </div>

                <Table 
                  dataSource={databaseUsers} 
                  columns={databaseColumns} 
                  rowKey="id"
                  pagination={{ 
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 人`,
                    pageSizeOptions: [10, 20, 50, 100],
                  }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        <div style={{ flex: 1 }}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="幸运抽奖">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: 8 }}>本次抽奖人数：</span>
                    <InputNumber 
                      min={1} 
                      max={getCurrentAvailableCount()} 
                      value={drawCount}
                      onChange={(value) => setDrawCount(value || 1)}
                    />
                  </div>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: 8 }}>每人只能中奖一次：</span>
                    <Switch 
                      checked={preventDuplicateWinners}
                      onChange={setPreventDuplicateWinners}
                    />
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    当前可参与人数：{getCurrentAvailableCount()} 人
                  </div>
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    loading={isSpinning}
                    onClick={showDrawConfirm}
                    style={{ marginBottom: 16 }}
                  >
                    {isSpinning ? '抽奖中...' : '开始抽奖'}
                  </Button>
                </div>
              </Card>
            </Col>

            <Col span={24}>
              <Card 
                title="本次中奖名单"
                extra={
                  <Button 
                    icon={<ClearOutlined />} 
                    onClick={clearWinners}
                    danger
                  >
                    清空记录
                  </Button>
                }
              >
                <Table 
                  dataSource={currentWinners} 
                  columns={winnersColumns} 
                  pagination={false}
                  rowKey={(record) => `current-${record.key}`}
                />
              </Card>
            </Col>

            <Col span={24}>
              <Card title="历史中奖名单">
                <Table 
                  dataSource={allWinners} 
                  columns={winnersColumns} 
                  rowKey={(record) => `all-${record.key}`}
                  pagination={{ 
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 人`,
                    pageSizeOptions: [10, 20, 50, 100],
                  }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      {/* 中奖结果弹窗 */}
      <Modal
        title={null}
        open={winnerModalVisible}
        onCancel={() => setWinnerModalVisible(false)}
        footer={null}
        width={800}
        centered
        style={{ 
          textAlign: 'center',
        }}
        styles={{
          body: { padding: 0 },
          content: { 
            background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
            backgroundSize: '400% 400%',
            animation: 'gradientShift 8s ease infinite',
            borderRadius: '24px',
            overflow: 'hidden',
            border: 'none',
            position: 'relative',
            boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
          }
        }}
        className="winner-modal"
      >
        <div style={{ 
          padding: '50px 40px',
          position: 'relative',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          minHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* 装饰性背景元素 */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            width: '150px',
            height: '150px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '50%',
            opacity: 0.1,
            animation: 'float 4s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            top: '100px',
            right: '-30px',
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
            borderRadius: '50%',
            opacity: 0.1,
            animation: 'float 6s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
            borderRadius: '50%',
            opacity: 0.1,
            animation: 'float 5s ease-in-out infinite',
          }} />
          
          {/* 主要内容 */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* 精简的标题区域 */}
            <div style={{ 
              marginBottom: '40px',
              animation: 'slideUp 0.8s ease-out',
            }}>
              <Typography.Title 
                level={1} 
                style={{ 
                  color: '#2c3e50',
                  marginBottom: '15px',
                  fontSize: '36px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}
              >
                🎊 抽奖结果
              </Typography.Title>
              <div style={{
                width: '80px',
                height: '4px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                margin: '0 auto',
                borderRadius: '2px',
              }} />
            </div>
            
            {modalWinners.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                {/* 中奖统计卡片 */}
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px',
                  padding: '25px',
                  marginBottom: '35px',
                  boxShadow: '0 15px 35px rgba(102, 126, 234, 0.3)',
                  animation: 'slideUp 0.6s ease-out 0.2s both',
                }}>
                  <Typography.Title level={3} style={{ 
                    color: '#fff', 
                    margin: '0 0 8px 0',
                    fontSize: '24px',
                    fontWeight: 600,
                  }}>
                    恭喜以下 {modalWinners.length} 位获奖者
                  </Typography.Title>
                  <Typography.Text style={{ 
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '16px',
                  }}>
                    Lucky Winners Announcement
                  </Typography.Text>
                </div>
                
                {/* 中奖者展示区域 */}
                {modalWinners.length <= 4 ? (
                  // 少于等于4人：网格展示
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: modalWinners.length === 1 ? '1fr' : 
                                       modalWinners.length === 2 ? 'repeat(2, 1fr)' :
                                       'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px',
                    padding: '10px',
                  }}>
                    {modalWinners.map((winner, index) => (
                      <div 
                        key={`card-${winner.key}-${index}`}
                        style={{
                          background: '#fff',
                          borderRadius: '16px',
                          padding: '25px',
                          boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                          border: '2px solid #f0f0f0',
                          animation: `slideInScale 0.6s ease-out ${index * 0.15}s both`,
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-5px)';
                          e.currentTarget.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.2)';
                          e.currentTarget.style.borderColor = '#667eea';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                          e.currentTarget.style.borderColor = '#f0f0f0';
                        }}
                      >
                        {/* 获奖排名 */}
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '20px',
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: index === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 
                                     index === 1 ? 'linear-gradient(135deg, #C0C0C0, #A8A8A8)' :
                                     index === 2 ? 'linear-gradient(135deg, #CD7F32, #B8860B)' :
                                     'linear-gradient(135deg, #667eea, #764ba2)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                          animation: 'pulse 2s ease-in-out infinite',
                        }}>
                          {index + 1}
                        </div>

                        {/* 获奖者信息 */}
                        <div style={{ textAlign: 'center', paddingTop: '10px' }}>
                          <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            margin: '0 auto 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            color: '#fff',
                            fontWeight: 'bold',
                            boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                          }}>
                            {winner.name.charAt(0).toUpperCase()}
                          </div>
                          
                          <Typography.Title level={4} style={{ 
                            color: '#2c3e50',
                            marginBottom: '8px',
                            fontSize: '22px',
                            fontWeight: 600,
                          }}>
                            {winner.name}
                          </Typography.Title>
                          
                          <Typography.Text style={{ 
                            color: '#7f8c8d',
                            fontSize: '16px',
                            display: 'block',
                            marginBottom: '15px',
                          }}>
                            {winner.department || '未填写部门'}
                          </Typography.Text>

                          {/* 获奖标识 */}
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'rgba(102, 126, 234, 0.1)',
                            color: '#667eea',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 500,
                          }}>
                            🏆 幸运获奖者
                          </div>
                        </div>

                        {/* 装饰性元素 */}
                        <div style={{
                          position: 'absolute',
                          top: '15px',
                          left: '15px',
                          fontSize: '24px',
                          opacity: 0.6,
                          animation: 'bounce 2s ease-in-out infinite',
                        }}>
                          🎉
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // 超过4人：分层展示
                  <div>
                    {/* 前三名重点展示 */}
                    <div style={{ marginBottom: '30px' }}>
                      <Typography.Title level={4} style={{ 
                        color: '#2c3e50',
                        marginBottom: '20px',
                        fontSize: '18px',
                        textAlign: 'center',
                      }}>
                        🏆 前三名获奖者
                      </Typography.Title>
                      <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px',
                        maxWidth: '700px',
                        margin: '0 auto',
                      }}>
                        {modalWinners.slice(0, 3).map((winner, index) => (
                          <div 
                            key={`top-${winner.key}-${index}`}
                            style={{
                              background: '#fff',
                              borderRadius: '12px',
                              padding: '20px',
                              boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                              border: '2px solid #f0f0f0',
                              animation: `slideInScale 0.6s ease-out ${index * 0.1}s both`,
                              transition: 'all 0.3s ease',
                              position: 'relative',
                              textAlign: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-3px)';
                              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
                            }}
                          >
                            {/* 排名标识 */}
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '15px',
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: index === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 
                                         index === 1 ? 'linear-gradient(135deg, #C0C0C0, #A8A8A8)' :
                                         'linear-gradient(135deg, #CD7F32, #B8860B)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                            }}>
                              {index + 1}
                            </div>

                            <div style={{
                              width: '60px',
                              height: '60px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              margin: '0 auto 15px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              color: '#fff',
                              fontWeight: 'bold',
                            }}>
                              {winner.name.charAt(0).toUpperCase()}
                            </div>
                            
                            <Typography.Title level={5} style={{ 
                              color: '#2c3e50',
                              marginBottom: '5px',
                              fontSize: '18px',
                            }}>
                              {winner.name}
                            </Typography.Title>
                            
                            <Typography.Text style={{ 
                              color: '#7f8c8d',
                              fontSize: '14px',
                            }}>
                              {winner.department || '未填写部门'}
                            </Typography.Text>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 其余获奖者紧凑列表 */}
                    {modalWinners.length > 3 && (
                      <div>
                        <Typography.Title level={4} style={{ 
                          color: '#2c3e50',
                          marginBottom: '20px',
                          fontSize: '18px',
                          textAlign: 'center',
                        }}>
                          🎊 其他获奖者 ({modalWinners.length - 3}人)
                        </Typography.Title>
                        <div style={{
                          background: '#fff',
                          borderRadius: '16px',
                          padding: '20px',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                          border: '2px solid #f0f0f0',
                          maxHeight: '300px',
                          overflowY: 'auto',
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: modalWinners.length <= 8 ? 'repeat(auto-fit, minmax(250px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '15px',
                          }}>
                            {modalWinners.slice(3).map((winner, index) => (
                              <div 
                                key={`other-${winner.key}-${index}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '15px',
                                  background: 'rgba(102, 126, 234, 0.03)',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(102, 126, 234, 0.1)',
                                  animation: `slideInUp 0.4s ease-out ${index * 0.05}s both`,
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
                                  e.currentTarget.style.transform = 'translateX(5px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.03)';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                {/* 排名 */}
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  marginRight: '12px',
                                  flexShrink: 0,
                                }}>
                                  {index + 4}
                                </div>

                                {/* 头像 */}
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '18px',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  marginRight: '15px',
                                  flexShrink: 0,
                                }}>
                                  {winner.name.charAt(0).toUpperCase()}
                                </div>
                                
                                {/* 信息 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ 
                                    color: '#2c3e50',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    marginBottom: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}>
                                    {winner.name}
                                  </div>
                                  <div style={{ 
                                    color: '#7f8c8d',
                                    fontSize: '13px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}>
                                    {winner.department || '未填写部门'}
                                  </div>
                                </div>

                                {/* 获奖图标 */}
                                <div style={{
                                  fontSize: '20px',
                                  marginLeft: '10px',
                                  animation: 'bounce 2s ease-in-out infinite',
                                  animationDelay: `${index * 0.1}s`,
                                }}>
                                  🎉
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 底部提示信息 */}
            <div style={{ 
              background: 'rgba(102, 126, 234, 0.05)',
              border: '2px solid rgba(102, 126, 234, 0.1)',
              padding: '20px', 
              borderRadius: '16px',
              marginBottom: '35px',
            }}>
              <Typography.Text style={{ 
                color: '#667eea',
                fontSize: '16px',
                fontWeight: 500,
              }}>
                ✅ 获奖信息已自动保存至系统记录
              </Typography.Text>
            </div>

            {/* 操作按钮 */}
            <Button
              size="large"
              onClick={() => setWinnerModalVisible(false)}
              style={{
                height: '52px',
                fontSize: '18px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '16px',
                color: '#fff',
                boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
                minWidth: '200px',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
              }}
            >
              确认结果
            </Button>
          </div>
        </div>

        <style jsx>{`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes slideInScale {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(15px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes float {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg); 
            }
            50% { 
              transform: translateY(-15px) rotate(5deg); 
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-8px);
            }
            60% {
              transform: translateY(-4px);
            }
          }
          
          .winner-modal .ant-modal-content {
            background: transparent !important;
            box-shadow: none !important;
          }
          
          .winner-modal .ant-modal-body {
            padding: 0 !important;
          }
        `}</style>
      </Modal>
    </main>
  );
} 