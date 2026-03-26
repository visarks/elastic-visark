<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import {
  NButton, NIcon, NEmpty, NTree, NInput, NTag,
  NModal, NForm, NFormItem, NSelect, NSwitch, NInputNumber, NCollapse, NCollapseItem, useMessage
} from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import {
  AddOutline, CopyOutline, ExpandOutline, CloseOutline
} from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'
import JsonViewer from '@/components/JsonViewer.vue'

const props = defineProps<{
  indexName: string
  mapping: any
}>()

const emit = defineEmits<{
  refresh: []
}>()

const connectionStore = useConnectionStore()
const message = useMessage()

const viewMode = ref<'tree' | 'json'>('tree')
const expandedKeys = ref<string[]>([])
const searchValue = ref('')

// 添加字段弹窗
const showAddFieldModal = ref(false)
const newFieldForm = ref<Record<string, any>>({
  name: '',
  type: 'text'
})

// 字段类型选项
const fieldTypeOptions = [
  { label: 'text - 全文检索', value: 'text' },
  { label: 'keyword - 精确匹配', value: 'keyword' },
  { label: 'long - 长整型', value: 'long' },
  { label: 'integer - 整型', value: 'integer' },
  { label: 'short - 短整型', value: 'short' },
  { label: 'byte - 字节', value: 'byte' },
  { label: 'double - 双精度浮点', value: 'double' },
  { label: 'float - 单精度浮点', value: 'float' },
  { label: 'half_float - 半精度浮点', value: 'half_float' },
  { label: 'scaled_float - 缩放浮点', value: 'scaled_float' },
  { label: 'boolean - 布尔', value: 'boolean' },
  { label: 'date - 日期', value: 'date' },
  { label: 'date_nanos - 纳秒日期', value: 'date_nanos' },
  { label: 'binary - 二进制', value: 'binary' },
  { label: 'integer_range - 整数范围', value: 'integer_range' },
  { label: 'long_range - 长整数范围', value: 'long_range' },
  { label: 'date_range - 日期范围', value: 'date_range' },
  { label: 'ip_range - IP范围', value: 'ip_range' },
  { label: 'ip - IP地址', value: 'ip' },
  { label: 'completion - 自动补全', value: 'completion' },
  { label: 'geo_point - 地理坐标', value: 'geo_point' },
  { label: 'geo_shape - 地理形状', value: 'geo_shape' },
  { label: 'nested - 嵌套对象', value: 'nested' },
  { label: 'object - 对象', value: 'object' },
  { label: 'flattened - 扁平化', value: 'flattened' },
  { label: 'join - 父子关系', value: 'join' }
]

// 分析器选项
const analyzerOptions = [
  { label: 'standard', value: 'standard' },
  { label: 'simple', value: 'simple' },
  { label: 'whitespace', value: 'whitespace' },
  { label: 'stop', value: 'stop' },
  { label: 'keyword', value: 'keyword' },
  { label: 'pattern', value: 'pattern' },
  { label: 'fingerprint', value: 'fingerprint' },
  { label: 'ik_max_word (中文)', value: 'ik_max_word' },
  { label: 'ik_smart (中文)', value: 'ik_smart' }
]

// 日期格式选项
const dateFormatOptions = [
  { label: 'strict_date_optional_time', value: 'strict_date_optional_time' },
  { label: 'yyyy-MM-dd', value: 'yyyy-MM-dd' },
  { label: 'yyyy-MM-dd HH:mm:ss', value: 'yyyy-MM-dd HH:mm:ss' },
  { label: 'epoch_millis', value: 'epoch_millis' },
  { label: 'epoch_second', value: 'epoch_second' }
]

// 配置组名称
const groupNames: Record<string, string> = {
  analysis: '分析器设置',
  indexing: '索引设置',
  format: '格式设置',
  scaling: '缩放设置',
  advanced: '高级选项',
  relations: '关系设置'
}

// 字段类型对应的配置项
const typeConfigs: Record<string, { groups: string[], fields: Record<string, any> }> = {
  text: {
    groups: ['analysis', 'indexing'],
    fields: {
      analyzer: { type: 'select', label: '分析器', options: 'analyzer' },
      search_analyzer: { type: 'select', label: '搜索分析器', options: 'analyzer' },
      index: { type: 'switch', label: '索引', default: true },
      norms: { type: 'switch', label: '规范值', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  keyword: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false },
      ignore_above: { type: 'number', label: '忽略长度上限', placeholder: '如 256' }
    }
  },
  date: {
    groups: ['format', 'indexing'],
    fields: {
      format: { type: 'select', label: '格式', options: 'dateFormat', tag: true },
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  long: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false },
      null_value: { type: 'number', label: '空值默认' }
    }
  },
  integer: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false },
      null_value: { type: 'number', label: '空值默认' }
    }
  },
  double: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  float: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  scaled_float: {
    groups: ['scaling', 'indexing'],
    fields: {
      scaling_factor: { type: 'number', label: '缩放因子' },
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true }
    }
  },
  boolean: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  ip: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true },
      store: { type: 'switch', label: '存储', default: false }
    }
  },
  geo_point: {
    groups: ['indexing'],
    fields: {
      index: { type: 'switch', label: '索引', default: true },
      doc_values: { type: 'switch', label: 'Doc Values', default: true }
    }
  },
  object: {
    groups: ['advanced'],
    fields: {
      enabled: { type: 'switch', label: '启用', default: true },
      dynamic: { type: 'select', label: '动态映射', options: ['true', 'false', 'strict'] }
    }
  },
  nested: {
    groups: ['advanced'],
    fields: {
      include_in_parent: { type: 'switch', label: '包含在父文档' },
      include_in_root: { type: 'switch', label: '包含在根文档' }
    }
  },
  completion: {
    groups: ['analysis'],
    fields: {
      analyzer: { type: 'select', label: '分析器', options: 'analyzer' },
      search_analyzer: { type: 'select', label: '搜索分析器', options: 'analyzer' }
    }
  }
}

// 当前字段类型的配置
const currentTypeConfig = computed(() => {
  return typeConfigs[newFieldForm.value.type] || { groups: [], fields: {} }
})

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 将 Mapping 转换为树形数据
const treeData = computed<TreeOption[]>(() => {
  if (!props.mapping) return []
  const properties = props.mapping.properties || props.mapping || {}
  return buildTreeOptions(properties, '')
})

function buildTreeOptions(properties: any, prefix: string): TreeOption[] {
  const options: TreeOption[] = []

  for (const [name, prop] of Object.entries(properties)) {
    const p = prop as any
    const key = prefix ? `${prefix}.${name}` : name

    const option: TreeOption = {
      key,
      label: name
    }

    if (p.type) {
      option.suffix = () => {
        const tags: string[] = [p.type]
        if (p.index === false) tags.push('no-index')
        if (p.doc_values === false) tags.push('no-doc-values')
        return h('div', { style: { display: 'flex', gap: '4px' } },
          tags.map(t => h(NTag, { size: 'small', type: 'info' }, { default: () => t }))
        )
      }
    }

    const children: TreeOption[] = []
    if (p.properties) {
      children.push(...buildTreeOptions(p.properties, key))
    }

    if (p.fields) {
      for (const [fieldName, fieldProp] of Object.entries(p.fields)) {
        const fp = fieldProp as any
        children.push({
          key: `${key}.${fieldName}`,
          label: fieldName,
          suffix: () => h(NTag, { size: 'small', type: 'info' }, { default: () => fp.type || 'text' })
        })
      }
    }

    if (children.length > 0) {
      option.children = children
    }

    options.push(option)
  }

  return options
}

// 过滤后的树形数据
const filteredTreeData = computed(() => {
  if (!searchValue.value) return treeData.value
  return filterTree(treeData.value, searchValue.value.toLowerCase())
})

function filterTree(options: TreeOption[], keyword: string): TreeOption[] {
  const result: TreeOption[] = []
  for (const option of options) {
    const label = typeof option.label === 'string' ? option.label : String(option.key)
    const match = label.toLowerCase().includes(keyword)

    if (option.children && option.children.length > 0) {
      const filteredChildren = filterTree(option.children, keyword)
      if (filteredChildren.length > 0) {
        result.push({ ...option, children: filteredChildren })
      } else if (match) {
        result.push(option)
      }
    } else if (match) {
      result.push(option)
    }
  }
  return result
}

function expandAll() {
  expandedKeys.value = getAllKeys(treeData.value)
}

function collapseAll() {
  expandedKeys.value = []
}

function getAllKeys(options: TreeOption[]): string[] {
  const keys: string[] = []
  for (const option of options) {
    keys.push(option.key as string)
    if (option.children) {
      keys.push(...getAllKeys(option.children))
    }
  }
  return keys
}

async function copyMapping() {
  if (!props.mapping) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.mapping, null, 2))
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

// 打开添加字段弹窗
function openAddFieldModal() {
  newFieldForm.value = { name: '', type: 'text' }
  // 设置默认值
  const config = typeConfigs.text
  if (config) {
    for (const [field, fieldConfig] of Object.entries(config.fields)) {
      if (fieldConfig.default !== undefined) {
        newFieldForm.value[field] = fieldConfig.default
      }
    }
  }
  showAddFieldModal.value = true
}

// 监听类型变化，设置默认值
watch(() => newFieldForm.value.type, (newType) => {
  const config = typeConfigs[newType]
  if (config) {
    for (const [field, fieldConfig] of Object.entries(config.fields)) {
      if (newFieldForm.value[field] === undefined && fieldConfig.default !== undefined) {
        newFieldForm.value[field] = fieldConfig.default
      }
    }
  }
})

// 添加字段
async function addField() {
  if (!newFieldForm.value.name) {
    message.warning('请输入字段名称')
    return
  }

  const active = currentActive.value
  if (!active) return

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  // 构建字段定义
  const fieldDef: any = { type: newFieldForm.value.type }
  const config = typeConfigs[newFieldForm.value.type]

  if (config) {
    for (const [field, fieldConfig] of Object.entries(config.fields)) {
      const value = newFieldForm.value[field]
      if (value !== undefined && value !== '' && value !== null && value !== fieldConfig.default) {
        fieldDef[field] = value
      }
    }
  }

  const body = { properties: { [newFieldForm.value.name]: fieldDef } }

  try {
    await client.execute('PUT', `/${props.indexName}/_mapping`, body)
    message.success('添加字段成功')
    showAddFieldModal.value = false
    emit('refresh')
  } catch (error: any) {
    message.error(`添加字段失败: ${error.message}`)
  }
}

// 获取选项列表
function getFieldOptions(fieldConfig: any): any[] {
  if (typeof fieldConfig.options === 'string') {
    if (fieldConfig.options === 'analyzer') return analyzerOptions
    if (fieldConfig.options === 'dateFormat') return dateFormatOptions
    return []
  }
  return fieldConfig.options.map((o: any) => typeof o === 'string' ? { label: o, value: o } : o)
}
</script>

<template>
  <div class="mapping-tab">
    <div class="tab-toolbar">
      <div class="toolbar-left">
        <n-input
          v-model:value="searchValue"
          placeholder="搜索字段..."
          size="small"
          clearable
          style="width: 200px"
        />
        <n-button size="small" quaternary @click="expandAll">
          <template #icon>
            <n-icon :component="ExpandOutline" />
          </template>
        </n-button>
        <n-button size="small" quaternary @click="collapseAll">
          <template #icon>
            <n-icon :component="CloseOutline" />
          </template>
        </n-button>
      </div>
      <div class="toolbar-right">
        <n-button size="small" :type="viewMode === 'tree' ? 'primary' : 'default'" @click="viewMode = 'tree'">
          树形
        </n-button>
        <n-button size="small" :type="viewMode === 'json' ? 'primary' : 'default'" @click="viewMode = 'json'">
          JSON
        </n-button>
        <n-button size="small" type="primary" @click="openAddFieldModal">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
          添加字段
        </n-button>
        <n-button size="small" quaternary :disabled="!mapping" @click="copyMapping">
          <template #icon>
            <n-icon :component="CopyOutline" />
          </template>
        </n-button>
      </div>
    </div>

    <div class="tab-content">
      <template v-if="viewMode === 'tree'">
        <n-tree
          v-if="filteredTreeData.length > 0"
          :data="filteredTreeData"
          :expanded-keys="expandedKeys"
          block-line
          virtual-scroll
          @update:expanded-keys="expandedKeys = $event as string[]"
        />
        <n-empty v-else description="暂无 Mapping 数据" />
      </template>
      <template v-else>
        <JsonViewer v-if="mapping" :content="mapping" height="calc(100vh - 350px)" />
        <n-empty v-else description="暂无 Mapping 数据" />
      </template>
    </div>

    <!-- 添加字段弹窗 -->
    <n-modal
      v-model:show="showAddFieldModal"
      preset="card"
      title="添加字段"
      style="width: 600px; max-height: 80vh; overflow: auto;"
      :bordered="false"
    >
      <n-form label-placement="left" label-width="120px">
        <n-form-item label="字段名称" required>
          <n-input v-model:value="newFieldForm.name" placeholder="field_name" />
        </n-form-item>
        <n-form-item label="字段类型">
          <n-select
            v-model:value="newFieldForm.type"
            :options="fieldTypeOptions"
            filterable
          />
        </n-form-item>

        <!-- 动态配置项 -->
        <n-collapse v-if="currentTypeConfig.groups.length > 0">
          <n-collapse-item
            v-for="group in currentTypeConfig.groups"
            :key="group"
            :title="groupNames[group] || group"
          >
            <template v-for="(fieldConfig, fieldName) in currentTypeConfig.fields" :key="fieldName">
              <n-form-item
                v-if="fieldConfig.type"
                :label="fieldConfig.label"
                :required="fieldConfig.required"
              >
                <n-switch
                  v-if="fieldConfig.type === 'switch'"
                  v-model:value="newFieldForm[fieldName]"
                />
                <n-input-number
                  v-else-if="fieldConfig.type === 'number'"
                  v-model:value="newFieldForm[fieldName]"
                  :placeholder="fieldConfig.placeholder"
                  style="width: 100%"
                />
                <n-select
                  v-else-if="fieldConfig.type === 'select'"
                  v-model:value="newFieldForm[fieldName]"
                  :options="getFieldOptions(fieldConfig)"
                  :tag="fieldConfig.tag"
                  clearable
                />
                <n-input
                  v-else-if="fieldConfig.type === 'input'"
                  v-model:value="newFieldForm[fieldName]"
                  :placeholder="fieldConfig.placeholder"
                />
              </n-form-item>
            </template>
          </n-collapse-item>
        </n-collapse>
      </n-form>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showAddFieldModal = false">取消</n-button>
          <n-button type="primary" @click="addField">添加</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.mapping-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tab-content {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

:root[data-theme='light'] {
  .tab-toolbar {
    border-bottom-color: #e0e0e0;
  }
}
</style>