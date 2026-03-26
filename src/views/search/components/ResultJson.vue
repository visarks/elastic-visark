<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { NButton, NIcon, useMessage } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  data: any
}>()

const message = useMessage()
const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// 获取编辑器主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化编辑器
function initEditor() {
  if (!editorContainer.value) return

  destroyEditor()

  editor = monaco.editor.create(editorContainer.value, {
    value: JSON.stringify(props.data, null, 2),
    language: 'json',
    theme: getEditorTheme(),
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'indentation',
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  })
}

// 销毁编辑器
function destroyEditor() {
  if (editor) {
    editor.dispose()
    editor = null
  }
}

// 复制
async function copyContent() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))
    message.success('复制成功')
  } catch {
    message.error('复制失败')
  }
}

// 监听主题变化
const themeObserver = new MutationObserver(() => {
  if (editor) {
    monaco.editor.setTheme(getEditorTheme())
  }
})

watch(() => props.data, () => {
  if (editor) {
    editor.setValue(JSON.stringify(props.data, null, 2))
  }
})

onMounted(() => {
  initEditor()
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
})

onUnmounted(() => {
  destroyEditor()
  themeObserver.disconnect()
})
</script>

<template>
  <div class="result-json">
    <div class="json-toolbar">
      <n-button size="small" quaternary @click="copyContent">
        <template #icon>
          <n-icon :component="CopyOutline" />
        </template>
        复制
      </n-button>
    </div>
    <div ref="editorContainer" class="json-editor"></div>
  </div>
</template>

<style scoped lang="scss">
.result-json {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.json-toolbar {
  padding: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.json-editor {
  flex: 1;
  min-height: 0;
}

// 浅色主题
:root[data-theme='light'] {
  .json-toolbar {
    border-bottom-color: #e0e0e0;
  }
}
</style>