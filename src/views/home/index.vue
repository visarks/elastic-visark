<script setup lang="ts">
import { computed } from 'vue'
import { NGrid, NGi } from 'naive-ui'
import { useConnectionStore } from '@/store/modules/connection'
import { Search, Code, DocumentText, Settings } from '@vicons/ionicons5'
import LogoIcon from '@/assets/logo.svg'

const connectionStore = useConnectionStore()

const currentActive = computed(() => connectionStore.currentActiveConnection)

const features = [
  {
    icon: Search,
    title: '智能搜索',
    description: '可视化查询构建器，支持复杂条件查询和聚合分析',
    color: '#63e2b7'
  },
  {
    icon: Code,
    title: 'SQL 查询',
    description: '使用 SQL 语法查询 Elasticsearch，支持语法高亮和自动补全',
    color: '#70c0e8'
  },
  {
    icon: DocumentText,
    title: '模板管理',
    description: '管理索引模板，支持新旧版本模板的创建和编辑',
    color: '#f2c97d'
  },
  {
    icon: Settings,
    title: 'REST 控制台',
    description: '直接执行任意 REST API 请求，完整的请求响应查看',
    color: '#e88080'
  }
]
</script>

<template>
  <div class="home-page">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="logo-wrapper">
          <img :src="LogoIcon" alt="elastic-visark" class="hero-logo" />
        </div>
        <h1 class="hero-title">elastic-visark</h1>
        <p class="hero-subtitle">Elasticsearch 可视化管理工具</p>
        <p class="hero-description">
          轻量级、跨平台的 Elasticsearch 客户端，提供直观的数据浏览、查询构建和集群管理功能
        </p>

        <div v-if="currentActive" class="hero-status">
          <span class="status-dot"></span>
          <span class="status-text">已连接到 {{ currentActive.connection.name }}</span>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="features-section">
      <h2 class="section-title">核心功能</h2>
      <n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
        <n-gi v-for="feature in features" :key="feature.title">
          <div class="feature-card">
            <div class="feature-icon" :style="{ backgroundColor: feature.color + '20', color: feature.color }">
              <n-icon :component="feature.icon" size="28" />
            </div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
          </div>
        </n-gi>
      </n-grid>
    </div>

    <!-- Footer -->
    <div class="footer-section">
      <p class="version">Version 0.1.0</p>
      <p class="copyright">Made with ❤️ for Elasticsearch</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  overflow: auto;
}

.hero-section {
  text-align: center;
  margin-bottom: 60px;
}

.hero-content {
  max-width: 600px;
  margin: 0 auto;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.logo-wrapper {
  margin-bottom: 24px;
}

.hero-logo {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 0 20px rgba(99, 226, 183, 0.3));
}

.hero-title {
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #63e2b7 0%, #70c0e8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 18px;
  color: #888;
  margin: 0 0 16px 0;
  font-weight: 400;
}

.hero-description {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  margin: 0 0 32px 0;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.hero-cta {
  margin-top: 24px;
}

.cta-button {
  font-size: 15px;
  padding: 0 32px;
  height: 44px;
  border-radius: 22px;
  background: linear-gradient(135deg, #63e2b7 0%, #4caf50 100%);
  border: none;
  box-shadow: 0 4px 20px rgba(99, 226, 183, 0.3);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(99, 226, 183, 0.4);
  }
}

.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: rgba(99, 226, 183, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(99, 226, 183, 0.2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #63e2b7;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: 14px;
  color: #63e2b7;
}

.features-section {
  width: 100%;
  max-width: 900px;
  margin-bottom: 40px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  margin: 0 0 24px 0;
}

.feature-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-4px);
  }
}

.feature-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px 0;
}

.feature-description {
  font-size: 13px;
  color: #888;
  line-height: 1.6;
  margin: 0;
}

.footer-section {
  text-align: center;
}

.version {
  font-size: 12px;
  color: #555;
  margin: 0 0 4px 0;
}

.copyright {
  font-size: 12px;
  color: #444;
  margin: 0;
}

// 浅色主题
:root[data-theme='light'] {
  .home-page {
    background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 50%, #d4dbe3 100%);
  }

  .hero-title {
    background: linear-gradient(135deg, #18a058 0%, #2080f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    color: #666;
  }

  .hero-description {
    color: #888;
  }

  .section-title {
    color: #333;
  }

  .feature-card {
    background-color: rgba(255, 255, 255, 0.8);
    border-color: rgba(0, 0, 0, 0.06);

    &:hover {
      background-color: rgba(255, 255, 255, 1);
      border-color: rgba(0, 0, 0, 0.1);
    }
  }

  .feature-title {
    color: #333;
  }

  .feature-description {
    color: #666;
  }

  .version,
  .copyright {
    color: #999;
  }
}

// 响应式
@media (max-width: 900px) {
  .features-section {
    :deep(.n-grid) {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
}

@media (max-width: 600px) {
  .home-page {
    padding: 24px;
  }

  .hero-title {
    font-size: 32px;
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .features-section {
    :deep(.n-grid) {
      grid-template-columns: 1fr !important;
    }
  }
}
</style>