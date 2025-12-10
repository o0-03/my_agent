import type React from 'react';
import { useState } from 'react';
import type { TodoListData, TodoItem } from '../types';
import {
  Card,
  List,
  Checkbox,
  Button,
  Input,
  Tag,
  Progress,
  Space,
  Tooltip,
  Empty,
  message,
  InputNumber,
  Select,
  Row,
  Col,
  Statistic,
  Badge,
  Switch,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TagOutlined,
  StarOutlined,
  StarFilled,
  StarTwoTone,
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

interface AntdTodoListProps {
  data: TodoListData;
}

const AntdTodoList: React.FC<AntdTodoListProps> = ({ data }) => {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    return data.items.map(item => ({
      ...item,
      completed: item.completed || false,
    }));
  });

  const [newTask, setNewTask] = useState<string>('');
  const [newTaskCategory, setNewTaskCategory] = useState<string>(
    data.items[0]?.category || '默认',
  );
  const [newTaskPriority, setNewTaskPriority] =
    useState<TodoItem['priority']>('medium');
  const [newTaskTime, setNewTaskTime] = useState<number>(30);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  // 统计数据
  const completedCount = todos.filter(todo => todo.completed).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const totalTime = todos.reduce((sum, todo) => sum + todo.estimated_time, 0);
  const completedTime = todos
    .filter(todo => todo.completed)
    .reduce((sum, todo) => sum + todo.estimated_time, 0);

  const categories = Array.from(new Set(todos.map(todo => todo.category)));

  // 切换任务状态
  const toggleTodo = (id: string) => {
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );

    const todo = todos.find(t => t.id === id);
    if (todo) {
      message.info(
        todo.completed
          ? `"${todo.content.substring(0, 20)}..." 已取消完成`
          : `"${todo.content.substring(0, 20)}..." 已完成`,
      );
    }
  };

  // 删除任务
  const deleteTodo = (id: string) => {
    const todoToDelete = todos.find(todo => todo.id === id);
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));

    if (todoToDelete) {
      message.success(
        `已删除任务: ${todoToDelete.content.substring(0, 20)}...`,
      );
    }
  };

  // 添加任务
  const addTodo = () => {
    if (!newTask.trim()) {
      message.warning('请输入任务内容');
      return;
    }

    if (newTaskTime <= 0 || newTaskTime > 480) {
      message.warning('任务时间需在1-480分钟之间');
      return;
    }

    const newId = `todo_${Date.now()}`;
    const newTodo: TodoItem = {
      id: newId,
      content: newTask.trim(),
      priority: newTaskPriority,
      estimated_time: newTaskTime,
      category: newTaskCategory,
      completed: false,
    };

    setTodos(prev => [newTodo, ...prev]);
    setNewTask('');
    setNewTaskTime(30);
    message.success('任务添加成功！');
  };

  // 编辑任务
  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditingContent(content);
  };

  const saveEdit = (id: string) => {
    if (!editingContent.trim()) {
      message.warning('任务内容不能为空');
      return;
    }

    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, content: editingContent.trim() } : todo,
      ),
    );

    setEditingId(null);
    setEditingContent('');
    message.success('任务已更新');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  // 批量操作
  const toggleAllTodos = () => {
    const allCompleted = todos.every(todo => todo.completed);
    setTodos(prevTodos =>
      prevTodos.map(todo => ({ ...todo, completed: !allCompleted })),
    );

    message.success(
      allCompleted ? '已取消所有任务的完成状态' : '所有任务标记为完成',
    );
  };

  const clearCompleted = () => {
    const completedTodos = todos.filter(todo => todo.completed);
    if (completedTodos.length === 0) {
      message.info('没有已完成的任务');
      return;
    }

    setTodos(prevTodos => prevTodos.filter(todo => !todo.completed));
    message.success(`已清除 ${completedTodos.length} 个已完成的任务`);
  };

  // 优先级相关函数
  const getPriorityColor = (priority: TodoItem['priority']): string => {
    switch (priority) {
      case 'high':
        return '#ff4d4f';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return '#1890ff';
    }
  };

  const getPriorityIcon = (priority: TodoItem['priority']) => {
    switch (priority) {
      case 'high':
        return <StarFilled style={{ color: '#ff4d4f' }} />;
      case 'medium':
        return <StarOutlined style={{ color: '#faad14' }} />;
      case 'low':
        return <StarTwoTone twoToneColor="#52c41a" />;
      default:
        return <StarOutlined />;
    }
  };

  const getPriorityText = (priority: TodoItem['priority']): string => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '中';
    }
  };

  // 键盘事件处理
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTodo();
    }
  };

  // 分类选择
  const handleCategorySelect = (value: string) => {
    if (value === 'new_category') {
      const newCat = prompt('请输入新分类名称:');
      if (newCat?.trim()) {
        setNewTaskCategory(newCat.trim());
      }
    } else {
      setNewTaskCategory(value);
    }
  };

  // 排序任务（未完成的在前面）
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  return (
    <Card
      title={
        <Space>
          <span>{data.title}</span>
          <Badge
            count={totalCount}
            style={{ backgroundColor: '#1890ff' }}
            showZero
          />
        </Space>
      }
      extra={
        <Space size="large">
          <Statistic
            title="完成率"
            value={Math.round(progress)}
            suffix="%"
            valueStyle={{ color: progress === 100 ? '#52c41a' : '#1890ff' }}
          />
        </Space>
      }
      style={{
        width: '100%',
        marginBottom: 24,
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" style={{ backgroundColor: 'var(--bg-card)' }}>
            <Statistic
              title="总任务"
              value={totalCount}
              prefix="📋"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ backgroundColor: 'var(--bg-card)' }}>
            <Statistic
              title="已完成"
              value={completedCount}
              prefix="✅"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ backgroundColor: 'var(--bg-card)' }}>
            <Statistic
              title="总时间"
              value={totalTime}
              suffix="分钟"
              prefix="⏱️"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ backgroundColor: 'var(--bg-card)' }}>
            <Statistic
              title="分类"
              value={categories.length}
              prefix="📁"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 进度条 */}
      <div style={{ marginBottom: 24 }}>
        <Progress
          percent={Math.round(progress)}
          status={progress === 100 ? 'success' : 'active'}
          strokeColor={{
            '0%': '#1890ff',
            '100%': '#52c41a',
          }}
          format={percent => `${percent}% 完成`}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}
        >
          <span>
            {completedTime}/{totalTime} 分钟
          </span>
          <span>
            {completedCount}/{totalCount} 任务
          </span>
        </div>
      </div>

      {/* 添加新任务 */}
      <Card
        size="small"
        style={{
          marginBottom: 24,
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
        title="添加新任务"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <TextArea
            placeholder="输入任务描述..."
            value={newTask}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setNewTask(e.target.value)
            }
            onKeyDown={handleKeyPress}
            autoSize={{ minRows: 2, maxRows: 4 }}
            showCount
            maxLength={500}
          />

          <Space
            wrap
            style={{ width: '100%', justifyContent: 'space-between' }}
          >
            <Space wrap>
              <Select
                value={newTaskPriority}
                onChange={(value: TodoItem['priority']) =>
                  setNewTaskPriority(value)
                }
                style={{ width: 100 }}
              >
                <Option value="high">
                  <Space>
                    {getPriorityIcon('high')}
                    <span>高</span>
                  </Space>
                </Option>
                <Option value="medium">
                  <Space>
                    {getPriorityIcon('medium')}
                    <span>中</span>
                  </Space>
                </Option>
                <Option value="low">
                  <Space>
                    {getPriorityIcon('low')}
                    <span>低</span>
                  </Space>
                </Option>
              </Select>

              <InputNumber
                min={1}
                max={480}
                value={newTaskTime}
                onChange={(value: number | null) => setNewTaskTime(value || 30)}
                addonBefore={<ClockCircleOutlined />}
                addonAfter="分钟"
                style={{ width: 120 }}
              />

              <Select
                value={newTaskCategory}
                onChange={handleCategorySelect}
                style={{ width: 120 }}
                suffixIcon={<TagOutlined />}
              >
                {categories.map(category => (
                  <Option key={category} value={category}>
                    {category}
                  </Option>
                ))}
                <Option value="new_category">+ 新建分类</Option>
              </Select>
            </Space>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={addTodo}
              size="middle"
            >
              添加任务
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 任务列表 */}
      {sortedTodos.length === 0 ? (
        <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" onClick={() => setNewTask('示例任务')}>
            创建第一个任务
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={sortedTodos}
          renderItem={(todo: TodoItem) => (
            <List.Item
              key={todo.id}
              actions={[
                editingId === todo.id ? (
                  <Space key={`actions-${todo.id}`}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => saveEdit(todo.id)}
                    >
                      保存
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      取消
                    </Button>
                  </Space>
                ) : (
                  <Space key={`actions-${todo.id}`}>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => startEdit(todo.id, todo.content)}
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => deleteTodo(todo.id)}
                        size="small"
                      />
                    </Tooltip>
                  </Space>
                ),
              ]}
              style={{
                opacity: todo.completed ? 0.7 : 1,
                backgroundColor: todo.completed
                  ? 'var(--bg-secondary)'
                  : 'var(--bg-card)',
                borderRadius: 8,
                marginBottom: 8,
                padding: '12px 16px',
                border: `1px solid ${todo.completed ? 'var(--border-color)' : 'var(--border-light)'}`,
                transition: 'all 0.3s',
              }}
            >
              <List.Item.Meta
                avatar={
                  <Checkbox
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    style={{ marginTop: 6 }}
                  />
                }
                title={
                  <Space align="center">
                    {editingId === todo.id ? (
                      <Input
                        value={editingContent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditingContent(e.target.value)
                        }
                        style={{ width: 400 }}
                        onPressEnter={() => saveEdit(todo.id)}
                      />
                    ) : (
                      <>
                        <span
                          style={{
                            textDecoration: todo.completed
                              ? 'line-through'
                              : 'none',
                            color: todo.completed
                              ? 'var(--text-tertiary)'
                              : 'var(--text-primary)',
                            fontSize: 15,
                          }}
                        >
                          {todo.content}
                        </span>
                        {todo.completed && (
                          <CheckCircleOutlined
                            style={{ color: '#52c41a', fontSize: 14 }}
                          />
                        )}
                      </>
                    )}
                  </Space>
                }
                description={
                  <Space size="small" style={{ marginTop: 4 }}>
                    <Tag
                      color={getPriorityColor(todo.priority)}
                      icon={getPriorityIcon(todo.priority)}
                    >
                      {getPriorityText(todo.priority)}优先级
                    </Tag>
                    <Tag color="blue" icon={<ClockCircleOutlined />}>
                      {todo.estimated_time}分钟
                    </Tag>
                    <Tag color="purple" icon={<TagOutlined />}>
                      {todo.category}
                    </Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 底部操作 */}
      {todos.length > 0 && (
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            <Button onClick={toggleAllTodos} icon={<CheckCircleOutlined />}>
              {todos.every(t => t.completed) ? '全部取消完成' : '全部标记完成'}
            </Button>
            <Button
              danger
              onClick={clearCompleted}
              disabled={completedCount === 0}
            >
              清除已完成 ({completedCount})
            </Button>
          </Space>

          <Space>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              提示: 双击任务可快速编辑
            </span>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default AntdTodoList;
