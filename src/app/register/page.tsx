'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, Spin, App } from 'antd';
import { UserOutlined, TeamOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface RoomInfo {
  id: number;
  room_id: string;
  name: string;
  description?: string;
  total_users: number;
  current_winners: number;
}

// 添加CSS样式
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 15s ease infinite',
    padding: '20px',
    paddingTop: '84px', // 为顶部导航栏留出空间
    position: 'relative' as const,
    overflow: 'hidden',
  },
  mobileNavbar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    height: '64px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  navTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1677ff',
    margin: 0,
    flex: 1,
    textAlign: 'center' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    padding: '0 8px',
  },
  floatingElements: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    opacity: 0.1,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    animation: 'slideUp 0.6s ease-out',
    overflow: 'hidden',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 400,
    textAlign: 'center' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    animation: 'slideUp 0.6s ease-out',
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    animation: 'bounce 1s ease-in-out',
  },
  errorIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    animation: 'shake 0.5s ease-in-out',
  },
  submitButton: {
    width: '100%',
    height: '48px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
  },
  continueButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    padding: '8px 24px',
    height: '40px',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
  },
  navButton: {
    border: 'none',
    background: 'transparent',
    color: '#1677ff',
    fontSize: '20px',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// 移动端导航栏组件
function MobileNavbar({ roomInfo }: { roomInfo: RoomInfo | null }) {
  const router = useRouter();

  return (
    <div style={styles.mobileNavbar} className="mobile-navbar">
      <button 
        style={styles.navButton}
        className="nav-button"
        onClick={() => router.back()}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(22, 119, 255, 0.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <ArrowLeftOutlined />
      </button>
      
      <div style={styles.navTitle} className="nav-title">
        {roomInfo ? `参与 ${roomInfo.name}` : '参与抽奖'}
      </div>
      
      <button 
        style={styles.navButton}
        className="nav-button"
        onClick={() => router.push('/')}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(22, 119, 255, 0.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <HomeOutlined />
      </button>
    </div>
  );
}

// 创建一个使用 useSearchParams 的子组件
function RegisterForm() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');

  useEffect(() => {
    // 添加CSS动画
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
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
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-10px);
        }
        60% {
          transform: translateY(-5px);
        }
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
      }
      
      .floating-element {
        position: absolute;
        animation: float 6s ease-in-out infinite;
      }
      
      .submit-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6) !important;
      }
      
      .continue-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6) !important;
      }
      
      /* 移动端适配 */
      @media (max-width: 768px) {
        .mobile-navbar {
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .container {
          padding: 16px !important;
          padding-top: 80px !important;
        }
        
        .card {
          max-width: 100% !important;
          margin: 0 auto;
          border-radius: 12px !important;
        }
        
        .loading-card {
          max-width: 100% !important;
          margin: 0 auto;
          border-radius: 12px !important;
        }
        
        /* 优化表单在移动端的显示 */
        .ant-form-item-label > label {
          font-size: 14px !important;
        }
        
        .ant-input {
          font-size: 16px !important; /* 防止iOS缩放 */
        }
        
        .ant-btn {
          font-size: 16px !important;
        }
      }
      
      @media (max-width: 480px) {
        .container {
          padding: 12px !important;
          padding-top: 76px !important;
        }
        
        .card {
          border-radius: 8px !important;
        }
        
        .loading-card {
          border-radius: 8px !important;
        }
        
        .mobile-navbar {
          padding: 8px 12px !important;
          height: 56px !important;
        }
        
        .nav-title {
          font-size: 16px !important;
        }
        
        .nav-button {
          font-size: 18px !important;
          padding: 6px !important;
        }
        
        /* 进一步优化小屏幕表单 */
        .ant-card-head-title {
          font-size: 18px !important;
        }
        
        .ant-typography h2 {
          font-size: 20px !important;
        }
      }
      
      /* 触摸设备优化 */
      @media (hover: none) and (pointer: coarse) {
        .submit-button:hover,
        .continue-button:hover {
          transform: none;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
        }
        
        .submit-button:active,
        .continue-button:active {
          transform: scale(0.98);
        }
      }
    `;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomId) {
        setInfoLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setRoomInfo(data.room);
        } else {
          console.error('Failed to fetch room info');
        }
      } catch (error) {
        console.error('Error fetching room info:', error);
      } finally {
        setInfoLoading(false);
      }
    };

    fetchRoomInfo();
  }, [roomId]);

  const onFinish = async (values: { name: string; department?: string }) => {
    if (!roomId) {
      message.error('缺少房间信息');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users', {
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
        message.success('注册成功！您现在可以参与抽奖了');
        setSubmitted(true);
        form.resetFields();
      } else {
        message.error(data.error || '注册失败，请重试');
      }
    } catch (error) {
      console.error('Registration error:', error);
      message.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 浮动装饰元素
  const FloatingElements = () => (
    <div style={styles.floatingElements}>
      <div className="floating-element" style={{ top: '10%', left: '10%', animationDelay: '0s' }}>
        🎉
      </div>
      <div className="floating-element" style={{ top: '20%', right: '10%', animationDelay: '2s' }}>
        🎊
      </div>
      <div className="floating-element" style={{ bottom: '30%', left: '5%', animationDelay: '4s' }}>
        ✨
      </div>
      <div className="floating-element" style={{ bottom: '10%', right: '15%', animationDelay: '1s' }}>
        🎁
      </div>
      <div className="floating-element" style={{ top: '60%', left: '85%', animationDelay: '3s' }}>
        🌟
      </div>
    </div>
  );

  if (infoLoading) {
    return (
      <div style={styles.container}>
        <MobileNavbar roomInfo={roomInfo} />
        <FloatingElements />
        <Card style={styles.loadingCard} className="loading-card">
          <div style={{ padding: '40px 20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px' }}>
              <Text type="secondary">加载房间信息中...</Text>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!roomId || !roomInfo) {
    return (
      <div style={styles.container}>
        <MobileNavbar roomInfo={roomInfo} />
        <FloatingElements />
        <Card style={styles.loadingCard} className="loading-card">
          <div style={{ padding: '40px 20px' }}>
            <div style={styles.errorIcon}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            </div>
            <Title level={2} style={{ color: '#ff4d4f', marginBottom: '10px' }}>
              房间无效
            </Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              抽奖房间不存在或已关闭
            </Text>
          </div>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <MobileNavbar roomInfo={roomInfo} />
        <FloatingElements />
        <Card style={styles.loadingCard} className="loading-card">
          <div style={{ padding: '40px 20px' }}>
            <div style={styles.successIcon}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </div>
            <Title level={2} style={{ color: '#52c41a', marginBottom: '10px' }}>
              注册成功！
            </Title>
            <Text type="secondary" style={{ fontSize: '16px', marginBottom: '20px' }}>
              您已成功报名参与抽奖活动
            </Text>
            <Button 
              className="continue-button"
              style={styles.continueButton}
              onClick={() => setSubmitted(false)}
              size="large"
            >
              继续注册其他用户
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <MobileNavbar roomInfo={roomInfo} />
      <FloatingElements />
              <Card
          title={
            <div style={{ textAlign: 'center', color: '#1f1f1f' }}>
              <Title level={2} style={{ margin: 0, color: 'inherit', fontWeight: 700 }}>
                🎯 参与抽奖
              </Title>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                {roomInfo.name}
              </Text>
            </div>
          }
          style={styles.card}
          className="card"
          styles={{
            body: { padding: '30px' }
          }}
        >
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          padding: '16px',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '12px',
          border: '1px solid #e1f5fe'
        }}>
          <Text style={{ color: '#0277bd', fontWeight: 500 }}>
            📊 当前报名人数：<strong>{roomInfo.total_users}</strong> | 🏆 已中奖：<strong>{roomInfo.current_winners}</strong>
          </Text>
        </div>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            label={
              <span style={{ fontWeight: 600, color: '#262626' }}>
                <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                姓名
              </span>
            }
            name="name"
            rules={[
              { required: true, message: '请输入您的姓名' },
              { min: 2, message: '姓名至少需要2个字符' },
              { max: 20, message: '姓名不能超过20个字符' }
            ]}
          >
            <Input 
              placeholder="请输入您的姓名" 
              style={{ 
                borderRadius: '12px',
                border: '2px solid #f0f0f0',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 2px rgba(102, 126, 234, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#f0f0f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </Form.Item>

          <Form.Item
            label={
              <span style={{ fontWeight: 600, color: '#262626' }}>
                <TeamOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                部门（可选）
              </span>
            }
            name="department"
            rules={[
              { max: 50, message: '部门名称不能超过50个字符' }
            ]}
          >
            <Input 
              placeholder="请输入您的部门" 
              style={{ 
                borderRadius: '12px',
                border: '2px solid #f0f0f0',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 2px rgba(102, 126, 234, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#f0f0f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: '32px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="submit-button"
              style={styles.submitButton}
            >
              {loading ? '提交中...' : '🎊 立即报名'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

// 主组件用 Suspense 包装
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <MobileNavbar roomInfo={null} />
        <Card style={styles.loadingCard} className="loading-card">
          <div style={{ padding: '40px 20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px' }}>
              <Text type="secondary">加载中...</Text>
            </div>
          </div>
        </Card>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}