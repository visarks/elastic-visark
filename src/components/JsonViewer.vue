<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  content: any
  height?: string
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null
let initialized = false

// 获取编辑器主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化编辑器
function initEditor() {
  if (!editorContainer.value || initialized) return

  initialized = true

  const jsonStr = props.content
    ? (typeof props.content === 'string' ? props.content : JSON.stringify(props.content, null, 2))
    : '{}'

  editorInstance = monaco.editor.create(editorContainer.value, {
    value: jsonStr,
    language: 'json',
    theme: getEditorTheme(),
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'indentation',
    renderWhitespace: 'none',
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8
    }
  })
}

// 更新内容
function updateContent() {
  if (editorInstance) {
    const jsonStr = props.content
      ? (typeof props.content === 'string' ? props.content : JSON.stringify(props.content, null, 2))
      : '{}'
    editorInstance.setValue(jsonStr)
  }
}

// 销毁编辑器
function destroyEditor() {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
    initialized = false
  }
}

// 监听内容变化
watch(() => props.content, () => {
  if (initialized) {
    updateContent()
  } else {
    nextTick(() => {
      initEditor()
    })
  }
}, { deep: true })

// 监听主题变化
function handleThemeChange() {
  if (editorInstance) {
    monaco.editor.setTheme(getEditorTheme())
  }
}

onMounted(() => {
  nextTick(() => {
    initEditor()
  })
  // 监听主题变化
  const observer = new MutationObserver(handleThemeChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  onUnmounted(() => {
    observer.disconnect()
    destroyEditor()
  })
})
</script>

<template>
  <div
    ref="editorContainer"
    class="json-viewer"
    :style="{ height: height || '100%' }"
  ></div>
</template>

<style scoped lang="scss">
.json-viewer {
  width: 100%;
  background-color: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

:root[data-theme='light'] {
  .json-viewer {
    background-color: #fff;
  }
}
</style>