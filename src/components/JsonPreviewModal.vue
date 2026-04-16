<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NButton, NIcon, useMessage } from 'naive-ui'
import { Close, CopyOutline, DownloadOutline } from '@vicons/ionicons5'
import * as monaco from 'monaco-editor'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const message = useMessage()

const showModal = ref(false)
const title = ref('JSON 预览')
const jsonContent = ref('')
const editorContainer = ref<HTMLElement | null>(null)
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null

// 打开弹窗
function open(newTitle: string, content: any) {
  title.value = newTitle
  jsonContent.value = JSON.stringify(content, null, 2)
  showModal.value = true
  // 延迟初始化确保 modal 完全打开
  setTimeout(() => {
    initEditor()
  }, 100)
}

// 关闭弹窗
function close() {
  showModal.value = false
  destroyEditor()
}

// 获取当前主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化编辑器
function initEditor() {
  if (!editorContainer.value) return

  destroyEditor()

  editorInstance = monaco.editor.create(editorContainer.value, {
    value: jsonContent.value,
    language: 'json',
    theme: getEditorTheme(),
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: false,
    folding: true,
    foldingStrategy: 'indentation',
    renderWhitespace: 'none',
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  })

  // 延迟聚焦和布局，确保 modal 已完全打开
  setTimeout(() => {
    editorInstance?.focus()
    editorInstance?.layout()
  }, 50)
}

// 销毁编辑器
function destroyEditor() {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
}

// 复制内容
async function copyContent() {
  try {
    await navigator.clipboard.writeText(jsonContent.value)
    message.success('复制成功')
  } catch (error) {
    message.error('复制失败')
  }
}

// 下载文件
async function downloadContent() {
  try {
    const filePath = await save({
      defaultPath: `${title.value.replace(/\s+/g, '_')}.json`,
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    })

    if (filePath) {
      await writeTextFile(filePath, jsonContent.value)
      message.success('下载成功')
    }
  } catch (error) {
    console.error('Download failed:', error)
    message.error('下载失败')
  }
}

// 监听弹窗关闭
watch(showModal, (val) => {
  if (!val) {
    destroyEditor()
  }
})

// 暴露方法
defineExpose({
  open
})
</script>

<template>
  <n-modal
    v-model:show="showModal"
    :mask-closable="true"
    :trap-focus="false"
    style="width: 80vw; max-width: 1000px; top: 50px"
    :bordered="false"
    @update:show="(val) => !val && close()"
  >
    <div class="json-preview">
      <div class="preview-header">
        <span class="preview-title">{{ title }}</span>
        <div class="preview-actions">
          <n-button size="small" quaternary @click="copyContent">
            <template #icon>
              <n-icon :component="CopyOutline" />
            </template>
          </n-button>
          <n-button size="small" quaternary @click="downloadContent">
            <template #icon>
              <n-icon :component="DownloadOutline" />
            </template>
          </n-button>
          <n-button size="small" quaternary @click="close">
            <template #icon>
              <n-icon :component="Close" />
            </template>
          </n-button>
        </div>
      </div>
      <div ref="editorContainer" class="preview-content"></div>
    </div>
  </n-modal>
</template>

<style scoped lang="scss">
.json-preview {
  background-color: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 80vh;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #252526;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
}

.preview-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-content {
  flex: 1;
  min-height: 0;
}

:root[data-theme='light'] {
  .json-preview {
    background-color: #fff;
  }

  .preview-header {
    background-color: #f3f3f3;
    border-bottom-color: #e0e0e0;
  }

  .preview-title {
    color: #333;
  }

  .preview-content {
    background-color: #fff;
  }
}
</style>