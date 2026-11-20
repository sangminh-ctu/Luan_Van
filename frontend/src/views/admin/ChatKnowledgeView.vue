<template>
  <section class="container-fluid py-3">
    <h1 class="h4 mb-3">Tài liệu chatbot</h1>
    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <form class="d-flex flex-wrap gap-2 mb-3" @submit.prevent="upload">
      <div>
        <label for="chat-knowledge-file" class="form-label">{{ selected ? 'Chọn file thay thế' : 'Chọn tài liệu TXT hoặc Markdown' }}</label>
        <input id="chat-knowledge-file" ref="fileInput" class="form-control" type="file" accept=".txt,.md,.markdown" required />
      </div>
      <button class="btn btn-primary align-self-end" :disabled="busy">{{ selected ? 'Thay thế tài liệu' : 'Tải lên' }}</button>
      <button v-if="selected" type="button" class="btn btn-outline-secondary align-self-end" :disabled="busy" @click="selected = null">Hủy thay thế</button>
    </form>
    <div class="table-responsive">
      <table class="table align-middle">
        <thead><tr><th scope="col">Tài liệu</th><th scope="col">Phiên bản</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>
          <tr v-for="doc in documents" :key="doc.id">
            <td>{{ doc.name }}</td><td>{{ doc.version }}</td><td>{{ doc.active ? 'Đang áp dụng' : 'Đã tắt' }}</td>
            <td>
              <div class="d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="busy" @click="view(doc)">Xem nội dung</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="replace(doc)">Chọn file thay thế</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="toggle(doc)">{{ doc.active ? 'Tắt' : 'Bật' }}</button>
                <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="remove(doc)">Xóa</button>
              </div>
            </td>
          </tr>
          <tr v-if="!documents.length && !busy"><td colspan="4">Chưa có tài liệu.</td></tr>
        </tbody>
      </table>
    </div>
    <section v-if="preview" class="card card-body mt-3">
      <div class="d-flex justify-content-between align-items-start">
        <h2 class="h6 text-break">{{ preview.name }}</h2>
        <button type="button" class="btn-close" aria-label="Đóng nội dung" @click="preview = null"></button>
      </div>
      <pre class="mb-0 text-wrap text-break">{{ preview.content }}</pre>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '@/services/api'

const path = '/admin/chat-knowledge'
const documents = ref([])
const preview = ref(null)
const selected = ref(null)
const fileInput = ref(null)
const busy = ref(false)
const error = ref('')

async function run(action) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (requestError) {
    error.value = requestError.response?.status === 400
      ? requestError.response.data.message
      : 'Không thể cập nhật tài liệu chatbot. Bạn thử lại sau.'
  } finally {
    busy.value = false
  }
}

async function load() {
  const { data } = await api.get(path)
  documents.value = data
}

onMounted(() => run(load))

function replace(doc) {
  selected.value = doc.id
  fileInput.value.value = ''
  fileInput.value.focus()
}

function upload() {
  const file = fileInput.value.files[0]
  if (!file) return
  return run(async () => {
    const form = new FormData()
    form.append('file', file)
    if (selected.value) await api.put(path + '/' + selected.value, form)
    else await api.post(path, form)
    fileInput.value.value = ''
    selected.value = null
    preview.value = null
    await load()
  })
}

function view(doc) {
  return run(async () => {
    const { data } = await api.get(path + '/' + doc.id)
    preview.value = data
  })
}

function toggle(doc) {
  return run(async () => {
    await api.patch(path + '/' + doc.id, { active: !doc.active })
    await load()
  })
}

function remove(doc) {
  if (!window.confirm('Xóa tài liệu ' + doc.name + '?')) return
  return run(async () => {
    await api.delete(path + '/' + doc.id)
    if (preview.value?.id === doc.id) preview.value = null
    if (selected.value === doc.id) selected.value = null
    await load()
  })
}
</script>
