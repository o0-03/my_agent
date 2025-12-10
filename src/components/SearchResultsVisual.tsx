import type React from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Typography,
  Tooltip,
  Statistic,
  Row,
  Col,
  Progress,
  Divider,
  Avatar,
} from 'antd';
import {
  LinkOutlined,
  CopyOutlined,
  StarOutlined,
  StarFilled,
  ClockCircleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { SearchResultItem } from '../types';

const { Text, Paragraph } = Typography;

interface SearchResultsVisualProps {
  results: SearchResultItem[];
  searchTime?: number;
}

// 获取相关度颜色
const getRelevanceColor = (score: number): string => {
  if (score >= 0.8) return '#52c41a';
  if (score >= 0.6) return '#faad14';
  return '#ff4d4f';
};

// 获取星级显示
const getRelevanceStars = (score: number) => {
  const stars = [];
  const filledStars = Math.min(5, Math.ceil(score * 5));

  for (let i = 0; i < 5; i++) {
    if (i < filledStars) {
      stars.push(
        <StarFilled key={i} style={{ color: '#faad14', fontSize: 12 }} />,
      );
    } else {
      stars.push(
        <StarOutlined key={i} style={{ color: '#d9d9d9', fontSize: 12 }} />,
      );
    }
  }

  return <Space size={2}>{stars}</Space>;
};

// 获取网站图标
const getWebsiteIcon = (url: string): React.ReactNode => {
  try {
    const domain = new URL(url).hostname;
    return (
      <Avatar
        size="small"
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt={domain}
        style={{ marginRight: 8 }}
      />
    );
  } catch {
    return <LinkOutlined />;
  }
};

// 提取域名
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return `${url.substring(0, 30)}...`;
  }
};

const SearchResultsVisual: React.FC<SearchResultsVisualProps> = ({
  results,
  searchTime,
}) => {
  // 空状态
  if (!results || results.length === 0) {
    return (
      <Card
        size="small"
        style={{
          margin: '16px 0',
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '20px',
            color: 'var(--text-tertiary)',
          }}
        >
          <SafetyOutlined style={{ fontSize: 24, marginBottom: 8 }} />
          <div>未找到相关搜索结果</div>
        </div>
      </Card>
    );
  }

  // 统计数据
  const avgRelevance =
    results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
  const highRelevanceCount = results.filter(r => (r.score || 0) >= 0.8).length;

  return (
    <div style={{ margin: '16px 0' }}>
      {/* 统计卡片 */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Statistic
              title="搜索结果"
              value={results.length}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 24, color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均相关度"
              value={(avgRelevance * 100).toFixed(1)}
              suffix="%"
              valueStyle={{
                fontSize: 24,
                color: getRelevanceColor(avgRelevance),
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="高相关度"
              value={highRelevanceCount}
              suffix={`/${results.length}`}
              valueStyle={{ fontSize: 24, color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="搜索耗时"
              value={searchTime || 0}
              suffix="ms"
              valueStyle={{ fontSize: 24, color: '#722ed1' }}
            />
          </Col>
        </Row>

        {/* 相关度进度条 */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <Text type="secondary">相关度分布</Text>
            <Text type="secondary">{getRelevanceStars(avgRelevance)}</Text>
          </div>
          <Progress
            percent={Math.round(avgRelevance * 100)}
            strokeColor={{
              '0%': '#ff4d4f',
              '50%': '#faad14',
              '100%': '#52c41a',
            }}
            showInfo={false}
            size="small"
          />
        </div>
      </Card>

      {/* 搜索结果列表 */}
      <List
        dataSource={results}
        renderItem={(result, index) => (
          <List.Item key={index} style={{ padding: '12px 0' }}>
            <Card
              size="small"
              style={{
                width: '100%',
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-card)',
              }}
              bodyStyle={{ padding: 12 }}
            >
              {/* 结果头部 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Space align="center">
                  <Tag color="blue" style={{ marginRight: 0 }}>
                    #{index + 1}
                  </Tag>
                  <div
                    style={{
                      width: 4,
                      height: 16,
                      backgroundColor: getRelevanceColor(result.score || 0),
                      borderRadius: 2,
                      marginRight: 8,
                    }}
                  />
                  {getWebsiteIcon(result.url)}
                  <Text strong style={{ fontSize: 14 }}>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1890ff' }}
                    >
                      {result.title || '无标题'}
                    </a>
                  </Text>
                </Space>

                <Space>
                  {result.score && (
                    <Tag
                      color={getRelevanceColor(result.score)}
                      icon={<StarFilled />}
                      style={{ marginRight: 0 }}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </Tag>
                  )}
                  <Tooltip title="复制链接">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => navigator.clipboard.writeText(result.url)}
                    />
                  </Tooltip>
                </Space>
              </div>

              {/* 结果内容 */}
              <Paragraph
                ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                style={{
                  marginBottom: 8,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                {result.content || '无内容摘要'}
              </Paragraph>

              {/* 结果底部信息 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <Space size="small">
                    <span>{extractDomain(result.url)}</span>
                    <Divider type="vertical" />
                    <span>{result.content?.length || 0} 字符</span>
                    <Divider type="vertical" />
                    <ClockCircleOutlined />
                    <span>实时搜索</span>
                  </Space>
                </Text>

                <Button
                  type="link"
                  size="small"
                  href={result.url}
                  target="_blank"
                  icon={<LinkOutlined />}
                  style={{ padding: '0 4px' }}
                >
                  访问网站
                </Button>
              </div>
            </Card>
          </List.Item>
        )}
      />

      {/* 快捷操作 */}
      <Card
        size="small"
        style={{
          marginTop: 16,
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <Space wrap>
          <Text type="secondary">快捷操作：</Text>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              const allUrls = results.map(r => r.url).join('\n');
              navigator.clipboard.writeText(allUrls);
            }}
          >
            复制所有链接
          </Button>
          <Button
            size="small"
            onClick={() => {
              const allTitles = results
                .map((r, i) => `${i + 1}. ${r.title}`)
                .join('\n');
              navigator.clipboard.writeText(allTitles);
            }}
          >
            复制所有标题
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              for (const result of results) {
                window.open(result.url, '_blank');
              }
            }}
          >
            一键打开所有链接
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default SearchResultsVisual;
