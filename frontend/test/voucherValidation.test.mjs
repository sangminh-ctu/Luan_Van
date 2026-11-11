import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateVoucherForm } from '../src/utils/voucherValidation.js'

const form = {
  code: 'SACH10',
  discount_type: 'percent',
  discount_value: 10,
  min_order_value: 100000,
  max_discount_amount: 50000,
  usage_limit: 20,
  per_user_limit: 1,
  start_date: '2030-01-02T10:00:00',
  end_date: '2030-01-03T10:00:00',
  status: 'active',
}
const context = { originalStart: '', originalEnd: '', minimumLimit: 1, historyLocked: false }
const validate = (changes = {}, state = {}) =>
  validateVoucherForm({ ...form, ...changes }, { ...context, ...state }, '2030-01-01T10:00:00')

test('Reports multiple errors at their fields instead of only the first error', () => {
  const errors = validate({
    code: '',
    discount_value: 101,
    max_discount_amount: 2000000000,
    usage_limit: 1.5,
  })
  assert.deepEqual(Object.keys(errors).sort(), [
    'code',
    'discount_value',
    'max_discount_amount',
    'usage_limit',
  ])
  assert.match(errors.max_discount_amount, /100\.000đ/)
})
test('Explains monetary limits and clears errors when related fields are corrected', () => {
  assert.ok(validate({ max_discount_amount: 200000 }).max_discount_amount)
  assert.deepEqual(validate({ max_discount_amount: 100000 }), {})
  assert.deepEqual(validate({ max_discount_amount: 200000, min_order_value: 200000 }), {})
  assert.ok(validate({ discount_type: 'fixed_amount', discount_value: 200000 }).discount_value)
})
test('Optional fields remain optional, invalid money gets messages', () => {
  assert.deepEqual(validate({ max_discount_amount: '', usage_limit: null }), {})
  for (const value of [0, -1, 'abc', '1.234', 99999999999])
    assert.ok(validate({ discount_value: value }).discount_value)
  assert.ok(validate({ min_order_value: '' }).min_order_value)
})
test('Past, impossible and reversed dates point to the right input', () => {
  assert.ok(validate({ start_date: '2020-01-01T00:00:00' }).start_date)
  assert.ok(validate({ end_date: '2030-02-30T10:00:00' }).end_date)
  assert.ok(validate({ end_date: form.start_date }).end_date)
  assert.ok(validate({ end_date: '' }).end_date)
  assert.deepEqual(validate({ start_date: '2020-01-01T00:00:00', start_now: true }), {})
})
test('Existing dates and usage history preserve editing restrictions', () => {
  assert.deepEqual(
    validate({ start_date: '2020-01-01T00:00:00' }, { originalStart: '2020-01-01T00:00:00' }),
    {},
  )
  assert.ok(validate({ usage_limit: 10 }, { minimumLimit: 20, historyLocked: true }).usage_limit)
  assert.ok(validate({}, { originalEnd: '2030-01-04T10:00:00', historyLocked: true }).end_date)
})

test('Per-account limit is required and cannot be reduced after usage', () => {
  for (const value of ['', null, 0, -1, 1.5, 2147483648])
    assert.ok(validate({ per_user_limit: value }).per_user_limit)
  assert.deepEqual(validate({ per_user_limit: 2 }), {})
  assert.ok(
    validate({ per_user_limit: 1 }, { historyLocked: true, originalPerUserLimit: 2 })
      .per_user_limit,
  )
  assert.deepEqual(
    validate({ per_user_limit: 3 }, { historyLocked: true, originalPerUserLimit: 2 }),
    {},
  )
})
