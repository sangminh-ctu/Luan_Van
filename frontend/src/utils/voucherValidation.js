const blank = (value) => value === '' || value === null || value === undefined
const amount = (value) =>
  !blank(value) && /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) <= 9999999999.99
const money = (value) => Number(value).toLocaleString('vi-VN') + 'đ'
const canonicalDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    return null
  const canonical = value.length === 16 ? value + ':00' : value
  const date = new Date(canonical + 'Z')
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19) === canonical &&
    Number(value.slice(0, 4)) >= 2000
    ? canonical
    : null
}

export function validateVoucherForm(form, context, now) {
  const errors = {}
  const code = String(form.code ?? '').trim()
  if (!code) errors.code = 'Vui lòng nhập mã giảm giá, ví dụ SACHMOI10.'
  else if (!/^[A-Za-z0-9_-]{1,50}$/.test(code))
    errors.code =
      'Mã gồm tối đa 50 ký tự: chữ không dấu, số, dấu - hoặc _. Không nhập khoảng trắng giữa mã.'
  if (!['percent', 'fixed_amount'].includes(form.discount_type))
    errors.discount_type = 'Vui lòng chọn giảm theo phần trăm hoặc số tiền.'
  if (!amount(form.min_order_value))
    errors.min_order_value =
      'Nhập đơn tối thiểu từ 0 đến 9.999.999.999,99đ, tối đa 2 chữ số thập phân.'
  if (!amount(form.discount_value) || Number(form.discount_value) <= 0)
    errors.discount_value = 'Vui lòng nhập mức giảm lớn hơn 0, tối đa 2 chữ số thập phân.'
  else if (form.discount_type === 'percent' && Number(form.discount_value) > 100)
    errors.discount_value = 'Phần trăm giảm phải lớn hơn 0 và không vượt quá 100%.'
  else if (
    form.discount_type === 'fixed_amount' &&
    !errors.min_order_value &&
    Number(form.discount_value) > Number(form.min_order_value)
  )
    errors.discount_value = `Đơn tối thiểu đang là ${money(form.min_order_value)}. Số tiền giảm phải nhỏ hơn hoặc bằng ${money(form.min_order_value)}; hãy giảm mức giảm hoặc tăng đơn tối thiểu.`
  if (form.discount_type === 'percent' && !blank(form.max_discount_amount)) {
    if (!amount(form.max_discount_amount) || Number(form.max_discount_amount) <= 0)
      errors.max_discount_amount =
        'Nhập mức giảm tối đa lớn hơn 0, tối đa 2 chữ số thập phân; hoặc để trống nếu không giới hạn.'
    else if (
      !errors.min_order_value &&
      Number(form.max_discount_amount) > Number(form.min_order_value)
    )
      errors.max_discount_amount = `Đơn tối thiểu đang là ${money(form.min_order_value)}. Giảm tối đa không được vượt ${money(form.min_order_value)}; hãy giảm số tiền này hoặc tăng đơn tối thiểu.`
  }
  if (!blank(form.usage_limit)) {
    if (
      !/^\d+$/.test(String(form.usage_limit)) ||
      Number(form.usage_limit) < 1 ||
      Number(form.usage_limit) > 2147483647
    )
      errors.usage_limit =
        'Nhập số lượt dùng là số nguyên từ 1 đến 2.147.483.647; hoặc để trống nếu không giới hạn.'
    else if (Number(form.usage_limit) < context.minimumLimit)
      errors.usage_limit = `Giới hạn phải từ ${context.minimumLimit} lượt trở lên vì mã đã có lượt dùng hoặc lịch sử sử dụng.`
  }
  const start = form.start_now ? now : canonicalDate(form.start_date)
  const end = canonicalDate(form.end_date)
  if (!start) errors.start_date = 'Vui lòng chọn ngày và giờ bắt đầu hợp lệ (từ năm 2000).'
  else if (!form.start_now && start !== context.originalStart && start < now)
    errors.start_date =
      'Ngày bắt đầu đã qua. Hãy chọn thời gian tương lai hoặc chọn “Áp dụng ngay khi lưu” khi tạo mã.'
  if (!end) errors.end_date = 'Vui lòng chọn ngày và giờ kết thúc hợp lệ (từ năm 2000).'
  else if (end !== context.originalEnd && end <= now)
    errors.end_date = 'Ngày kết thúc đã qua. Hãy chọn thời gian sau hiện tại.'
  else if (start && end <= start)
    errors.end_date = 'Ngày kết thúc phải sau ngày bắt đầu. Hãy chọn lại ngày hoặc giờ kết thúc.'
  else if (context.historyLocked && end < context.originalEnd)
    errors.end_date = 'Mã đã có lịch sử sử dụng. Chỉ được giữ nguyên hoặc gia hạn ngày kết thúc.'
  if (!['active', 'disabled', 'expired'].includes(form.status))
    errors.status = 'Vui lòng chọn trạng thái hợp lệ.'
  return errors
}
