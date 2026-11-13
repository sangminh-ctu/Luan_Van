import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'

const { descriptor } = parse(
  readFileSync(new URL('../src/views/customer/PaymentResultView.vue', import.meta.url), 'utf8'),
)
const compiled = compileScript(descriptor, { id: 'payment-result-test' })
  .content.replace(/^import[^\n]+\n/gm, '')
  .replace('export default', 'return')
const factory = new Function(
  'deps',
  `const {ref,computed,onMounted,onBeforeUnmount,useRoute,orderService,setInterval,clearInterval}=deps; ${compiled}`,
)
const pending = {
  reference: 'a'.repeat(32),
  status: 'pending',
  order_id: 1,
  order_code: 'TEST',
  payment_status: 'pending',
  order_status: 'processing',
  amount: 100000,
}
function harness(t, overrides = {}, query = {}) {
  let mounted, dispose
  const intervals = [],
    cleared = []
  const api = {
    paymentStatus: async () => ({ ...pending }),
    reconcilePayment: async () => ({ ...pending }),
    ...overrides,
  }
  const scope = vue.effectScope()
  const component = factory({
    ...vue,
    onMounted: (fn) => {
      mounted = fn
    },
    onBeforeUnmount: (fn) => {
      dispose = fn
    },
    useRoute: () => ({ query: { reference: pending.reference, ...query } }),
    orderService: api,
    setInterval: (fn) => {
      intervals.push(fn)
      return intervals.length
    },
    clearInterval: (id) => cleared.push(id),
  })
  const state = scope.run(() => component.setup({}, { expose() {} }))
  t.after(() => {
    dispose()
    scope.stop()
  })
  return { state, api, intervals, cleared, mount: () => mounted(), dispose: () => dispose() }
}
test('Return query cannot claim success: result is based only on backend status', async (t) => {
  const { state, mount, intervals } = harness(
    t,
    {},
    {
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      payment_status: 'paid',
      return_status: 'verified',
    },
  )
  await mount()
  assert.match(state.heading.value, /chờ xác nhận/)
  assert.equal(state.terminal.value, false)
  assert.equal(intervals.length, 1)
})
test('Backend confirmed success stops polling; late-payment review takes precedence over paid label', async (t) => {
  const success = harness(t, {
    paymentStatus: async () => ({ ...pending, payment_status: 'paid', status: 'succeeded' }),
  })
  await success.mount()
  assert.equal(success.state.heading.value, 'Thanh toán thành công')
  assert.equal(success.intervals.length, 0)
  const review = harness(t, {
    paymentStatus: async () => ({
      ...pending,
      payment_status: 'paid',
      order_status: 'cancelled',
      status: 'review',
      payment_review_required: true,
    }),
  })
  await review.mount()
  assert.match(review.state.heading.value, /đối soát/)
  assert.equal(review.intervals.length, 0)
})
test('Reconciliation failure preserves pending status and polling can later confirm payment', async (t) => {
  const { state, api, mount, intervals, cleared } = harness(t, {
    reconcilePayment: async () => {
      throw { response: { data: { message: 'VNPAY chưa phản hồi' } } }
    },
  })
  await mount()
  assert.equal(state.result.value.payment_status, 'pending')
  assert.match(state.error.value, /chưa phản hồi/)
  await intervals[0]()
  assert.match(state.error.value, /chưa phản hồi/)
  api.paymentStatus = async () => ({ ...pending, status: 'succeeded', payment_status: 'paid' })
  await intervals[0]()
  assert.equal(state.heading.value, 'Thanh toán thành công')
  assert.ok(cleared.length)
})

test('Invalid callback warning stays visible while status polls are pending', async (t) => {
  const { state, mount, intervals } = harness(t, {}, { return_status: 'invalid' })
  await mount()
  assert.match(state.error.value, /chữ ký/)
  await intervals[0]()
  assert.match(state.error.value, /chữ ký/)
})

test('Throttled reconciliation and not-found provider result explain why payment is still pending', async (t) => {
  const { state, api, mount } = harness(t, {
    reconcilePayment: async () => ({ ...pending, reconciliation: { state: 'throttled' } }),
  })
  await mount()
  assert.match(state.error.value, /một phút/)
  api.reconcilePayment = async () => ({ ...pending, reconciliation: { state: 'not_found' } })
  await state.refresh(true)
  assert.match(state.error.value, /chưa tìm thấy/)
  assert.equal(state.result.value.payment_status, 'pending')
})
test('Unmount during a status request cannot start background polling or update the view', async (t) => {
  let resolve
  const request = new Promise((done) => {
    resolve = done
  })
  const { state, mount, dispose, intervals } = harness(t, { paymentStatus: () => request })
  const mounting = mount()
  dispose()
  resolve({ ...pending })
  await mounting
  assert.equal(state.result.value, null)
  assert.equal(intervals.length, 0)
})
