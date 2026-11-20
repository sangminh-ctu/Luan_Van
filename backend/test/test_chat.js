const assert = require('node:assert/strict');
const { test } = require('node:test');

const catalogPath = require.resolve('../src/services/customer/catalog.service');
// final_price là giá sau giảm thực tế; base_price là giá gốc (giống pricing.decorate).
const catalogBooks = [
    { book_id: 1, title: 'Án mạng đỏ', description: 'Một vụ án với nhiều manh mối. Thám tử lần theo dấu vết.', final_price: 120000, base_price: 150000, effective_discount_percent: 20, category: { category_name: 'Trinh thám' }, authors: [{ author_name: 'Agatha Christie' }], images: [{ image_url: '/uploads/1.jpg', is_primary: true }], categoryId: 1, authorId: 1, inStock: true },
    { book_id: 2, title: 'Vụ án cuối', description: 'Một cuộc điều tra.', final_price: 150000, base_price: 150000, categoryId: 1, authorId: 1, inStock: true },
    { book_id: 3, title: 'Chuyện lịch sử', description: 'Các sự kiện lịch sử Việt Nam.', final_price: 90000, base_price: 100000, effective_discount_percent: 10, category: { category_name: 'Lịch sử' }, categoryId: 2, inStock: true },
    { book_id: 4, title: 'Bí ẩn cổ', description: 'Một vụ án cũ.', final_price: 70000, base_price: 100000, effective_discount_percent: 30, categoryId: 1, inStock: false },
    { book_id: 5, title: 'Hồ sơ thám tử', description: 'Thu thập manh mối.', final_price: 80000, categoryId: 1, inStock: true },
];
const queries = [];
require.cache[catalogPath] = { exports: {
    getCategories: async () => [
        { category_id: 1, category_name: 'Trinh thám' },
        { category_id: 2, category_name: 'Lịch sử' },
        { category_id: 3, category_name: 'Văn học' },
        { category_id: 7, category_name: 'Công Nghệ Thông Tin' },
    ],
    getFilterOptions: async () => ({ authors: [{ author_id: 1, author_name: 'Agatha Christie' }, { author_id: 2, author_name: 'Paulo Coelho' }] }),
    getBooks: async (query, options = {}) => {
        queries.push({ ...query, ...options });
        return { pagination: { totalPages: 1 }, books: catalogBooks.filter(book =>
            (!query.category_id || book.categoryId === query.category_id)
            && (!query.author_id || book.authorId === query.author_id)
            && (query.min_price === undefined || book.final_price >= query.min_price)
            && (query.max_price === undefined || book.final_price <= query.max_price)
            && (!query.in_stock || book.inStock)
            && (!options.discountedOnly || (book.base_price ?? book.final_price) > book.final_price)
            && (!options.regularPriceOnly || (book.base_price ?? book.final_price) === book.final_price)
            && (!query.search || book.title.toLowerCase().includes(query.search.toLowerCase()))) };
    },
    getBookById: async id => {
        const book = catalogBooks.find(item => item.book_id === id);
        if (!book) throw Object.assign(new Error('not found'), { status: 404 });
        return book;
    },
    getRatingSummaries: async ids => new Map(ids.includes(1) ? [[1, { average: 4.5, total: 12 }]] : []),
} };
const { recommend } = require('../src/services/customer/chat');
const { readBudget } = require('../src/services/customer/chat/fallback-parser');

function geminiResponse(data) {
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }));
}
const emptyIntent = {
    intent: 'book_search', detailAspect: null, reply: null, followUp: false, cheaper: false, onSale: false, clearPrice: false,
    needsClarification: false, category: null, author: null, title: null, similarToTitle: null, maxPrice: null, bookIndex: null, preferences: [], keywords: [],
};
function withGemini(t, handler) {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    const fetch = t.mock.method(global, 'fetch', async (url, request) => {
        const schema = JSON.parse(request.body).generationConfig.responseJsonSchema;
        return handler(schema.properties.intent ? 'interpret' : 'compose', JSON.parse(request.body), url);
    });
    t.after(() => {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL;
        delete process.env.GEMINI_TIMEOUT_MS;
    });
    return fetch;
}

test('Bộ nghiệm thu 24 câu tiếng Việt (không có Gemini)', async t => {
    delete process.env.GEMINI_API_KEY;
    const writtenPrices = [
        ['Dưới 150.000đ', 149999], ['Tối đa 150.000 đồng', 150000],
        ['Không quá 150k', 150000], ['Ngân sách là 150 nghìn', 150000],
        ['Dưới một trăm năm mươi nghìn', 149999], ['Tối đa hai trăm lẻ năm nghìn', 205000],
        ['Dưới một triệu hai trăm nghìn', 1199999], ['Tối đa 1,5 triệu', 1500000],
        ['Dưới 1.200.000đ', 1199999], ['Dưới 0 đồng', -1],
        ['Tối đa mười lăm nghìn', 15000], ['Dưới một trăm linh một nghìn', 100999],
    ];
    for (const [question, expected] of writtenPrices) {
        await t.test(question, () => assert.equal(readBudget(question).maxPrice, expected));
    }

    const first = await recommend('Sách trinh thám tối đa 150k');
    const broad = await recommend('Gợi ý sách để tặng bạn');
    const unknown = await recommend('Sách trinh thám dưới mức phù hợp');
    const turns = [
        ['Tìm sách trinh thám dưới 150.000đ', {}, 1, 149999, [1, 5]],
        ['Sách trinh thám tối đa 150k', {}, 1, 150000, [1, 2, 5]],
        ['Đổi sang truyện lịch sử', first.context, 2, 150000, [3]],
        ['Bỏ giới hạn giá', first.context, 1, undefined, [1, 2, 5]],
        ['Có cuốn nào rẻ hơn không?', first.context, 1, 79999, []],
        ['Tìm sách của Agatha Christie', {}, undefined, undefined, [1, 2]],
        ['Tìm sách “Án mạng đỏ”', {}, undefined, undefined, [1]],
        ['Gợi ý sách để tặng bạn', {}, undefined, undefined, []],
        ['Gì cũng được', broad.context, undefined, undefined, [1, 2, 3]],
        ['Sách trinh thám dưới mức phù hợp', {}, 1, undefined, []],
        ['120k', unknown.context, 1, 120000, [1, 5]],
        ['Tìm sách lịch sử dưới 50k', {}, 2, 49999, []],
    ];
    for (const [question, context, category, budget, books] of turns) {
        await t.test(question, async () => {
            const result = await recommend(question, context);
            assert.equal(result.context.categoryId, category);
            assert.equal(result.context.maxPrice, budget);
            assert.deepEqual(result.books.map(book => book.id).sort(), books);
            assert.ok(result.books.length <= 3);
        });
    }
    assert.ok(queries.some(query => query.in_stock));
});

test('Lời chào và hội thoại thông thường không tìm sách', async t => {
    delete process.env.GEMINI_API_KEY;
    const fetch = t.mock.method(global, 'fetch', async () => { throw new Error('không được gọi Gemini'); });
    for (const question of ['xin chào', 'Chào bạn!', 'hello shop', 'Cảm ơn bạn nhiều', 'Tạm biệt']) {
        await t.test(question, async () => {
            const before = queries.length;
            const result = await recommend(question, { categoryId: 1, lastBookIds: [1, 5] });
            assert.equal(result.intent, 'greeting');
            assert.deepEqual(result.books, []);
            assert.doesNotMatch(result.reply, /chưa tìm được sách/i);
            assert.equal(queries.length, before, 'không truy vấn danh mục');
            assert.equal(result.context.categoryId, 1, 'giữ ngữ cảnh');
        });
    }
    assert.equal(fetch.mock.callCount(), 0);

    await t.test('Câu chào phức tạp do Gemini trả lời', async t => {
        withGemini(t, () => geminiResponse({ ...emptyIntent, intent: 'greeting', reply: 'Chào bạn, mình khỏe! Bạn đang muốn đọc thể loại gì?' }));
        const before = queries.length;
        const result = await recommend('Chào bạn, hôm nay bạn thế nào?');
        assert.equal(result.intent, 'greeting');
        assert.equal(result.replySource, 'gemini');
        assert.match(result.reply, /thể loại/);
        assert.equal(queries.length, before);
    });
});

test('Tìm sách giảm giá dùng giá sau giảm thực tế', async t => {
    delete process.env.GEMINI_API_KEY;
    await t.test('cuốn nào đang giảm giá', async () => {
        const result = await recommend('cuốn nào đang giảm giá');
        assert.equal(result.intent, 'discount_search');
        assert.equal(result.context.onSale, true);
        // Sách 4 giảm nhiều nhất nhưng hết hàng nên bị loại; sắp xếp theo mức giảm.
        assert.deepEqual(result.books.map(book => book.id), [1, 3]);
        const [first] = result.books;
        assert.equal(first.price, 120000);
        assert.equal(first.originalPrice, 150000);
        assert.equal(first.discountPercent, 20);
        assert.equal(first.image, '/uploads/1.jpg');
        assert.match(first.reason, /giảm 20%/);
        assert.match(first.reason, /4\.5\/5/);
        assert.equal(result.replySource, 'template');
        assert.ok(queries.at(-1).discountedOnly && queries.at(-1).in_stock);
    });
    await t.test('Giảm giá kết hợp thể loại và ngân sách', async () => {
        const result = await recommend('Sách trinh thám đang khuyến mãi dưới 130k');
        assert.deepEqual(result.books.map(book => book.id), [1]);
        assert.equal(result.context.maxPrice, 129999);
    });
    await t.test('Câu nối tiếp giữ điều kiện giảm giá', async () => {
        const sale = await recommend('cuốn nào đang giảm giá');
        const cheaper = await recommend('Có cuốn nào rẻ hơn không?', sale.context);
        assert.equal(cheaper.context.onSale, true);
        assert.deepEqual(cheaper.books.map(book => book.id), []);
        assert.equal(cheaper.context.maxPrice, 89999);
    });
    await t.test('Sách không giảm giá có originalPrice null', async () => {
        const result = await recommend('Tìm sách “Vụ án cuối”');
        assert.equal(result.books[0].originalPrice, null);
        assert.equal(result.books[0].discountPercent, 0);
    });
});

test('Không có kết quả: trả lời ngắn gọn và giữ bộ lọc trong ngữ cảnh', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await recommend('Tìm sách lịch sử dưới 50k');
    assert.deepEqual(result.books, []);
    assert.equal(result.reply, 'Hiện mình chưa tìm thấy sách phù hợp.');
    assert.equal(result.context.maxPrice, 49999);
    const inclusive = await recommend('Tìm sách lịch sử tối đa 50k');
    assert.deepEqual(inclusive.books, []);
    assert.equal(inclusive.reply, result.reply);
    assert.equal(inclusive.context.maxPrice, 50000);
    const sale = await recommend('Sách lịch sử đang giảm giá dưới 50k');
    assert.deepEqual(sale.books, []);
    assert.equal(sale.reply, result.reply);
    assert.equal(sale.context.discountStatus, 'sale');
});

test('Không giảm giá chỉ trả sách giá thường và câu dẫn khớp với danh sách', async () => {
    const result = await recommend('có sách nào không giảm giá không', { onSale: true, minDiscount: 10 });
    assert.equal(result.replySource, 'template');
    assert.match(result.reply, /giá thường/);
    assert.deepEqual(result.books.map(book => book.id), [2, 5]);
    assert.ok(result.books.every(book => book.originalPrice === null));
    const narrower = await recommend('tối đa 100k', result.context);
    assert.deepEqual(narrower.books.map(book => book.id), [5]);
    const discounts = await recommend('Có sách nào đang giảm giá không?', result.context);
    assert.ok(discounts.books.length > 0 && discounts.books.every(book => book.originalPrice > book.price));
    const empty = await recommend('Tìm sách lịch sử không giảm giá');
    assert.deepEqual(empty.books, []);
    assert.equal(empty.reply, 'Hiện mình chưa tìm thấy sách phù hợp.');
});

test('Đổi ngân sách và bỏ điều kiện giảm giá vẫn giữ chủ đề', async () => {
    const first = await recommend('Tìm sách trinh thám giảm giá dưới 130k');
    assert.equal(first.context.discountStatus, 'sale');
    const next = await recommend('Vẫn chủ đề đó, tăng lên 250 nghìn, giảm hay không cũng được', first.context);
    assert.equal(next.context.categoryId, 1);
    assert.equal(next.context.maxPrice, 250000);
    assert.equal(next.context.discountStatus, 'any');
    assert.deepEqual(next.books.map(book => book.id).sort(), [1, 2, 5]);
    const shorter = await recommend('Tăng lên 250 nghìn, giảm hay không cũng được', first.context);
    assert.deepEqual(shorter.books.map(book => book.id), next.books.map(book => book.id));
});

test('Bộ lọc do AI phân tích giữ ngưỡng dưới và trạng thái giá thường', async t => {
    withGemini(t, () => geminiResponse({ ...emptyIntent, discountStatus: 'regular', maxPrice: 150000, priceOperator: 'lt' }));
    const result = await recommend('Tư vấn truyện trinh thám theo khoản tiền mình định chi');
    assert.equal(result.context.maxPrice, 149999);
    assert.equal(result.context.discountStatus, 'regular');
    assert.match(result.reply, /dưới 150\.000đ/);
    assert.deepEqual(result.books.map(book => book.id), [5]);
});

test('Chủ đề mới kèm ngân sách không lấy sách bất kỳ dưới ngưỡng giá', async () => {
    delete process.env.GEMINI_API_KEY;
    const previous = await recommend('Tìm sách trinh thám tối đa 150k');
    const result = await recommend('Có sách học Python cho người mới, giá dưới 200.000 đồng không?', previous.context);
    assert.deepEqual(result.books, []);
    assert.equal(result.context.categoryId, undefined);
    assert.deepEqual(result.context.keywords, ['python']);
    assert.equal(result.reply, 'Hiện mình chưa tìm thấy sách phù hợp.');
    assert.equal(result.context.maxPrice, 199999);
    const more = await recommend('Tối đa 250k', result.context);
    assert.deepEqual(more.books, []);
    assert.deepEqual(more.context.keywords, ['python']);
});

test('Truyện tranh không khớp tiểu thuyết có nhắc truyện tranh trong mô tả', async t => {
    catalogBooks.push({ book_id: 92, title: 'Hồ Điệp Và Kình Ngư', description: 'Bản truyện tranh được nhắc đến trong phần giới thiệu.',
        categoryId: 3, category: { category_name: 'Tiểu Thuyết' }, final_price: 155000, inStock: true });
    t.after(() => catalogBooks.pop());
    const result = await recommend('sách về truyện tranh');
    assert.equal(result.reply, 'Hiện mình chưa tìm thấy sách phù hợp.');
    assert.deepEqual(result.books, []);
    const next = await recommend('Tối đa 200k', result.context);
    assert.deepEqual(next.books, []);
});

test('Chủ đề công nghệ tìm toàn danh mục, còn tên thể loại đầy đủ lọc theo thể loại', async t => {
    catalogBooks.push({ book_id: 90, title: 'Công nghệ robot', categoryId: 2, final_price: 110000, inStock: true },
        { book_id: 91, title: 'Tiểu thuyết thử nghiệm', description: 'Tác giả từng làm việc ở một công ty công nghệ.', categoryId: 2, final_price: 90000, inStock: true });
    t.after(() => catalogBooks.splice(-2));
    const fetch = withGemini(t, () => geminiResponse({ ...emptyIntent, category: 'Công Nghệ Thông Tin' }));
    const broad = await recommend('sách về công nghệ', { categoryId: 7, askedClarification: true });
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(broad.context.categoryId, undefined);
    assert.deepEqual(broad.books.map(book => book.id), [90]);
    assert.match(broad.reply, /về công nghệ/);
    const exact = await recommend('sách về công nghệ thông tin');
    assert.equal(exact.context.categoryId, 7);
    assert.deepEqual(exact.books, []);
});

test('Hỏi sách chung theo ngân sách không giữ chủ đề hoặc bộ lọc cũ', async () => {
    const previous = { categoryId: 2, title: 'Sách không tồn tại', onSale: true,
        keywords: ['duoc', 'ao'], requiredKeywords: ['duoc', 'ao'] };
    const fixtures = [
        ['mình có 300 nghìn có thể mua được sách ào', 300000],
        ['sách dưới 300 nghìn', 299999],
    ];
    for (const [message, maxPrice] of fixtures) {
        const result = await recommend(message, previous);
        assert.equal(result.context.maxPrice, maxPrice);
        assert.equal(result.context.categoryId, undefined);
        assert.equal(result.context.onSale, undefined);
        assert.equal(result.context.requiredKeywords, undefined);
        assert.equal(result.books.length, 3);
        assert.ok(result.books.every(book => book.price <= maxPrice));
    }
});

test('Khoảng giá có hai cận và mức giảm tối thiểu dùng giá thực tế', async () => {
    assert.deepEqual(readBudget('Tìm sách từ 100k đến 150k'), { minPrice: 100000, maxPrice: 150000 });
    const range = await recommend('Tìm sách trinh thám từ 100k đến 150k');
    assert.deepEqual(range.books.map(book => book.id).sort(), [1, 2]);
    assert.match(range.reply, /từ 100\.000đ đến 150\.000đ/);
    const discounts = await recommend('Tìm sách giảm từ 20%');
    assert.deepEqual(discounts.books.map(book => book.id), [1]);
});

test('Python đúng chủ đề, còn hàng, dưới ngân sách và ưu tiên sách nhập môn', async t => {
    const fixtures = [
        { book_id: 71, title: 'Python nâng cao', final_price: 160000, inStock: true },
        { book_id: 72, title: 'Python cho người mới', final_price: 190000, inStock: true },
        { book_id: 73, title: 'Java cho người mới', final_price: 120000, inStock: true },
        { book_id: 74, title: 'Python nhập môn', final_price: 200000, inStock: true },
        { book_id: 75, title: 'Thực hành Python cơ bản', final_price: 140000, inStock: false },
    ];
    catalogBooks.push(...fixtures);
    t.after(() => catalogBooks.splice(-fixtures.length));
    const result = await recommend('Có sách học Python cho người mới dưới 200k không?');
    assert.deepEqual(result.books.map(book => book.id), [72, 71]);
    assert.match(result.reply, /dưới 200\.000đ/);
});

test('Thiếu tồn kho không khẳng định còn hàng', async t => {
    const fixture = { book_id: 81, title: 'Sách Thiếu Tồn Kho', final_price: 50000 };
    catalogBooks.push(fixture);
    t.after(() => catalogBooks.pop());
    const result = await recommend('Sách Thiếu Tồn Kho còn hàng không?');
    assert.deepEqual(result.books.map(book => book.id), [81]);
    assert.match(result.reply, /chưa có thông tin tồn kho/);
});

test('FAQ dùng phiên bản đang áp dụng và kèm nguồn', async () => {
    const docs = [
        { id: 1, name: 'Đổi trả.md', version: 1, active: false, content: 'Sách giao nhầm được đổi trong 30 ngày.' },
        { id: 2, name: 'Đổi trả.md', version: 2, active: true, content: '# Sách giao nhầm\nSách giao nhầm được đổi trong 7 ngày kể từ khi nhận.' },
        { id: 3, name: 'Vận chuyển.txt', version: 1, active: true, content: 'Giao hàng nội thành trong 2 ngày.' },
    ];
    const result = await recommend('Sách giao nhầm đổi trong bao lâu?', {}, { loadDocuments: async () => docs });
    assert.equal(result.intent, 'policy_question');
    assert.match(result.reply, /7 ngày/);
    assert.doesNotMatch(result.reply, /30 ngày|2 ngày/);
    assert.deepEqual(result.sources, [{ id: 2, name: 'Đổi trả.md', version: 2, section: 'Sách giao nhầm' }]);
});

test('Groq trả 503 và chỉ chuyển sang Gemini khi được cấu hình', async t => {
    const previousEnv = Object.fromEntries(['AI_PROVIDER', 'AI_FALLBACK_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL',
        'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_RETRY_ONCE'].map(key => [key, process.env[key]]));
    t.after(() => {
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    Object.assign(process.env, { AI_PROVIDER: 'groq', GROQ_API_KEY: 'fixture', GROQ_MODEL: 'fixture-model',
        GEMINI_API_KEY: 'fixture', GEMINI_MODEL: 'fixture-model', AI_RETRY_ONCE: 'false' });
    delete process.env.AI_FALLBACK_PROVIDER;
    const { interpretQuestion } = require('../src/services/customer/chat/understand');
    const fetch = t.mock.method(global, 'fetch', async url => url.includes('groq.com')
        ? new Response(null, { status: 503 }) : geminiResponse(emptyIntent));
    const fallback = await interpretQuestion('Tìm sách', {}, [], 1000);
    assert.deepEqual(fallback, { ok: false, reason: 'http_503' });
    assert.equal(fetch.mock.callCount(), 1);
    process.env.AI_FALLBACK_PROVIDER = 'gemini';
    const switched = await interpretQuestion('Tìm sách', {}, [], 1000);
    assert.equal(switched.provider, 'gemini');
    assert.equal(fetch.mock.callCount(), 3);
    fetch.mock.mockImplementation(async (url, request) => {
        assert.match(url, /groq\.com/);
        assert.equal(JSON.parse(request.body).response_format.type, 'json_object');
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(emptyIntent) } }] }));
    });
    assert.equal((await interpretQuestion('Tìm sách', {}, [], 1000)).provider, 'groq');
    assert.equal(fetch.mock.callCount(), 4);
});

test('Câu hỏi nối tiếp về một cuốn trong danh sách', async t => {
    delete process.env.GEMINI_API_KEY;
    const first = await recommend('Sách trinh thám tối đa 150k');
    assert.equal(first.context.lastBookIds.length, 3);
    await t.test('Cuốn thứ hai thì sao?', async () => {
        const result = await recommend('Cuốn thứ hai thì sao?', first.context);
        assert.equal(result.intent, 'book_detail');
        assert.deepEqual(result.books.map(book => book.id), [first.context.lastBookIds[1]]);
        assert.match(result.reply, new RegExp(result.books[0].title));
        assert.equal(result.context.categoryId, 1, 'giữ điều kiện tìm kiếm');
    });
    await t.test('Cuốn đầu tiên có đánh giá', async () => {
        const result = await recommend('Kể thêm về cuốn đầu tiên', first.context);
        assert.equal(result.books[0].id, first.context.lastBookIds[0]);
    });
    await t.test('Chưa có danh sách thì hỏi lại', async () => {
        const result = await recommend('Cuốn thứ hai thì sao?', {});
        assert.notEqual(result.intent, 'book_detail');
    });
});

test('Câu hỏi chính sách không bịa thông tin và giữ ngữ cảnh', async () => {
    delete process.env.GEMINI_API_KEY;
    const before = queries.length;
    const result = await recommend('Chính sách đổi trả thế nào?', { categoryId: 2, maxPrice: 100000 });
    assert.equal(result.intent, 'policy_question');
    assert.deepEqual(result.books, []);
    assert.equal(result.context.categoryId, 2);
    assert.equal(result.context.maxPrice, 100000);
    assert.equal(queries.length, before);
});

test('Gemini phân tích, diễn đạt và chỉ ghép lý do hợp lệ vào dữ liệu danh mục', async t => {
    withGemini(t, stage => geminiResponse(stage === 'interpret'
        ? { ...emptyIntent, intent: 'book_recommendation', category: 'Trinh thám', maxPrice: 149999, preferences: ['dễ đọc'], keywords: ['phá án'] }
        : { reply: 'Có vài cuốn trinh thám hợp với bạn, mô tả chưa nói rõ độ dễ đọc nhé.', items: [
            { id: 99, reason: 'ID lạ' },
            { id: 1, reason: 'Mô tả giới thiệu một vụ án có nhiều manh mối, được chấm 4.5/5.' },
            { id: 5, reason: 'Chỉ 10.000 đồng' },
        ] }));
    const result = await recommend('Tìm truyện phá án dễ đọc');
    assert.equal(result.intent, 'book_recommendation');
    assert.equal(result.replySource, 'gemini');
    assert.match(result.reply, /dễ đọc/);
    assert.equal(result.context.maxPrice, 149999);
    assert.deepEqual(result.context.preferences, ['dễ đọc']);
    assert.match(result.books.find(book => book.id === 1).reason, /manh mối/);
    const book5 = result.books.find(book => book.id === 5);
    assert.equal(book5.price, 80000);
    assert.doesNotMatch(book5.reason, /10\.000/, 'lý do có giá bịa bị thay bằng lý do từ dữ liệu');
    assert.ok(result.books.every(book => book.id !== 99 && !('description' in book)));
});

test('Gemini trả lời bịa giá trong câu dẫn thì dùng câu dẫn từ backend', async t => {
    withGemini(t, stage => geminiResponse(stage === 'interpret'
        ? { ...emptyIntent, intent: 'discount_search', onSale: true }
        : { reply: 'Sách giảm còn 9.000đ thôi!', items: [] }));
    const result = await recommend('Có sách nào đang sale không?');
    assert.equal(result.replySource, 'template');
    assert.doesNotMatch(result.reply, /9\.000/);
    assert.deepEqual(result.books.map(book => book.id), [1, 3]);
});

test('Lỗi Gemini: fallback rõ ràng, có log, vẫn trả sách đúng điều kiện', async t => {
    const cases = [
        ['HTTP 429', () => new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), { status: 429 }), /quota_exceeded/],
        ['JSON lỗi', () => new Response('{'), /invalid_json/],
        ['Intent lạ', () => geminiResponse({ intent: 'find_books' }), /invalid_intent/],
    ];
    for (const [name, response, logPattern] of cases) {
        await t.test(name, async t => {
            const warn = t.mock.method(console, 'warn', () => {});
            withGemini(t, response);
            const result = await recommend('Sách trinh thám dưới 150k');
            assert.equal(result.context.maxPrice, 149999);
            assert.deepEqual(result.books.map(book => book.id).sort(), [1, 5]);
            assert.equal(result.replySource, 'fallback');
            assert.ok(warn.mock.calls.some(call => logPattern.test(call.arguments[0])));
            assert.ok(warn.mock.calls.every(call => !call.arguments.join(' ').includes('test-key')));
        });
    }
    await t.test('Timeout', async t => {
        const warn = t.mock.method(console, 'warn', () => {});
        withGemini(t, () => new Promise(() => {}));
        process.env.GEMINI_TIMEOUT_MS = '5';
        global.fetch.mock.mockImplementation(async (_url, { signal }) => {
            await new Promise((_, reject) => {
                const watchdog = setTimeout(() => reject(new Error('Abort signal missing')), 1000);
                signal.addEventListener('abort', () => {
                    clearTimeout(watchdog);
                    reject(signal.reason);
                }, { once: true });
            });
        });
        const result = await recommend('Sách trinh thám dưới 150k');
        assert.equal(result.books.length, 2);
        assert.ok(warn.mock.calls.some(call => /timeout/.test(call.arguments[0])));
    });
    await t.test('Thiếu GEMINI_MODEL thì không gọi API', async t => {
        const warn = t.mock.method(console, 'warn', () => {});
        const fetch = withGemini(t, () => geminiResponse(emptyIntent));
        delete process.env.GEMINI_MODEL;
        const result = await recommend('Tìm sách trinh thám đang giảm giá');
        assert.equal(fetch.mock.callCount(), 0);
        assert.equal(result.intent, 'discount_search');
        assert.ok(warn.mock.calls.some(call => /missing_model/.test(call.arguments[0])));
    });
    await t.test('Bước diễn đạt thất bại vẫn dùng lý do từ dữ liệu', async t => {
        t.mock.method(console, 'warn', () => {});
        const generate = withGemini(t, stage => stage === 'interpret'
            ? geminiResponse({ ...emptyIntent, category: 'Trinh thám', maxPrice: 149999 })
            : new Response(null, { status: 503 }));
        const result = await recommend('Tìm truyện phá án');
        assert.equal(generate.mock.callCount(), 2);
        assert.deepEqual(result.books.map(book => book.id).sort(), [1, 5]);
        assert.ok(result.books.every(book => book.reason.includes('thể loại')));
        assert.equal(result.replySource, 'fallback');
    });
});

test('Tra cứu sách cụ thể: giá, tồn kho, tác giả, sách tương tự và nhiều phiên bản', async t => {
    delete process.env.GEMINI_API_KEY;
    const extraBooks = [
        {
            book_id: 10,
            title: 'Nhà Giả Kim (Bản Thử Nghiệm)',
            description: 'Một cuốn sách kinh điển về hành trình theo đuổi ước mơ.',
            final_price: 39500,
            base_price: 79000,
            effective_discount_percent: 50,
            inventory: { stock_quantity: 6 },
            category: { category_name: 'Văn học' },
            authors: [{ author_name: 'Paulo Coelho' }],
            categoryId: 3,
            authorId: 2,
            inStock: true,
        },
        {
            book_id: 11,
            title: 'Rừng Xanh Nước Bạc',
            description: 'Câu chuyện cảm hứng từ bộ lạc sống trên rặng núi và ngôi nhà cổ.',
            final_price: 196200,
            base_price: 218000,
            effective_discount_percent: 10,
            inventory: { stock_quantity: 5 },
            category: { category_name: 'Tiểu thuyết' },
            authors: [{ author_name: 'Nguyên Phong' }],
            categoryId: 4,
            inStock: true,
        },
        {
            book_id: 12,
            title: 'Không Gia Đình',
            description: 'Hành trình cảm động của cậu bé Rémi.',
            final_price: 150000,
            base_price: 150000,
            inventory: { stock_quantity: 9 },
            category: { category_name: 'Văn học' },
            authors: [{ author_name: 'Hector Malot' }],
            categoryId: 3,
            inStock: true,
        },
        {
            book_id: 13,
            title: 'Cánh Đồng Bất Tận',
            description: 'Tập truyện ngắn văn học Việt Nam.',
            final_price: 85000,
            base_price: 85000,
            inventory: { stock_quantity: 4 },
            category: { category_name: 'Văn học' },
            authors: [{ author_name: 'Nguyễn Ngọc Tư' }],
            categoryId: 3,
            inStock: true,
        },
    ];
    catalogBooks.push(...extraBooks);
    t.after(() => {
        catalogBooks.splice(catalogBooks.length - extraBooks.length, extraBooks.length);
    });

    await t.test('Giá sách Nhà Giả Kim bao nhiêu? -> Chỉ trả đúng 1 cuốn Nhà Giả Kim, không lẫn Rừng Xanh Nước Bạc', async () => {
        for (const q of ['Giá sách Nhà Giả Kim bao nhiêu?', 'giá của sách Nhà Giả Kim', 'gia sach nha gia kim bao nhieu']) {
            const result = await recommend(q);
            assert.equal(result.intent, 'book_price');
            assert.equal(result.books.length, 1);
            assert.equal(result.books[0].id, 10);
            assert.equal(result.books[0].price, 39500);
            assert.equal(result.books[0].originalPrice, 79000);
            assert.equal(result.books[0].discountPercent, 50);
            assert.match(result.reply, /39\.500đ/);
            assert.match(result.reply, /79\.000đ/);
            assert.match(result.reply, /50%/);
            assert.notEqual(result.replySource, 'fallback');
        }
    });

    await t.test('Hỏi giá hiện tại và giảm giá của Rừng Xanh Nước Bạc', async () => {
        for (const question of [
            'Cuốn [têSách rừng xanh nước bạc hiện giá bao nhiêu? Có đang giảm giá không?',
            'Sách rừng xanh nước bạc hiện giá bao nhiêu? và có giảm giá không',
            'Rừng Xanh Nước Bạc hiện tại giá bao nhiêu?',
        ]) {
            const result = await recommend(question, { title: 'XYZ-999' });
            assert.equal(result.intent, 'book_price');
            assert.deepEqual(result.books.map(book => book.id), [11]);
            assert.match(result.reply, /196\.200đ.*218\.000đ.*giảm 10%/);
        }
    });

    await t.test('Một câu hỏi trả đủ tồn kho, giá và ưu đãi của đúng một cuốn', async () => {
        for (const message of [
            'Rừng Xanh Nước Bạc còn hàng không, giá bao nhiêu và có giảm không?',
            'Rung Xanh Nuoc Bac gia bao nhieu va con hang khong?',
        ]) {
            const result = await recommend(message);
            assert.deepEqual(result.books.map(book => book.id), [11]);
            assert.ok(result.aspects.includes('stock') && result.aspects.includes('price'));
            assert.match(result.reply, /Còn 5 cuốn/);
            assert.match(result.reply, /196\.200đ/);
            if (message.includes('giảm')) assert.match(result.reply, /giảm 10%/);
        }
    });

    await t.test('Nhà Giả Kim còn hàng không? -> Chỉ kiểm tra tồn kho Nhà Giả Kim từ DB', async () => {
        const inStockRes = await recommend('Nhà Giả Kim còn hàng không?');
        assert.equal(inStockRes.intent, 'book_stock');
        assert.deepEqual(inStockRes.books.map(b => b.id), [10]);
        assert.match(inStockRes.reply, /còn hàng/);
        assert.match(inStockRes.reply, /6 cuốn/);

        const outOfStockRes = await recommend('Bí ẩn cổ còn hàng không?');
        assert.equal(outOfStockRes.intent, 'book_stock');
        assert.deepEqual(outOfStockRes.books.map(b => b.id), [4]);
        assert.match(outOfStockRes.reply, /hết hàng/);
    });

    await t.test('Tác giả Nhà Giả Kim là ai? -> Chỉ trả thông tin tác giả của Nhà Giả Kim', async () => {
        const result = await recommend('Tác giả Nhà Giả Kim là ai?');
        assert.equal(result.intent, 'book_detail');
        assert.deepEqual(result.books.map(b => b.id), [10]);
        assert.match(result.reply, /Paulo Coelho/);
    });

    await t.test('Gợi ý sách văn học -> Trả tối đa 3 cuốn thuộc thể loại Văn học', async () => {
        const result = await recommend('Gợi ý sách văn học');
        assert.equal(result.context.categoryId, 3);
        assert.ok(result.books.length >= 2 && result.books.length <= 3);
        assert.deepEqual(result.books.map(b => b.id).sort((a, b) => a - b), [10, 12, 13]);
    });

    await t.test('Có sách nào giống Nhà Giả Kim không? -> Trả sách liên quan, không lặp lại Nhà Giả Kim', async () => {
        const result = await recommend('Có sách nào giống Nhà Giả Kim không?');
        assert.equal(result.intent, 'book_recommendation');
        assert.ok(result.books.length > 0 && result.books.length <= 3);
        assert.ok(result.books.every(b => b.id !== 10), 'không lặp lại Nhà Giả Kim');
        assert.deepEqual(result.books.map(b => b.id).sort((a, b) => a - b), [12]);
    });

    await t.test('Giá cuốn này bao nhiêu? sau khi chọn một sách -> Dùng đúng book_id trong ngữ cảnh', async () => {
        const selected = await recommend('Nhà Giả Kim còn hàng không?');
        assert.equal(selected.context.selectedBookId, 10);
        const priceFollowUp = await recommend('Giá cuốn này bao nhiêu?', selected.context);
        assert.equal(priceFollowUp.intent, 'book_price');
        assert.deepEqual(priceFollowUp.books.map(b => b.id), [10]);
        assert.match(priceFollowUp.reply, /39\.500đ/);
    });

    await t.test('Trường hợp nhiều phiên bản -> Yêu cầu khách chọn phiên bản rồi trả đúng bản được chọn', async () => {
        const specialEdition = {
            book_id: 14,
            title: 'Nhà Giả Kim (Bản Đặc Biệt Bìa Cứng)',
            description: 'Ấn bản bìa cứng giới hạn.',
            final_price: 129000,
            base_price: 129000,
            inventory: { stock_quantity: 3 },
            category: { category_name: 'Văn học' },
            authors: [{ author_name: 'Paulo Coelho' }],
            categoryId: 3,
            authorId: 2,
            inStock: true,
        };
        catalogBooks.push(specialEdition);
        try {
            const first = await recommend('Giá sách Nhà Giả Kim bao nhiêu?');
            assert.equal(first.books.length, 2);
            assert.deepEqual(first.books.map(b => b.id).sort((a, b) => a - b), [10, 14]);
            assert.match(first.reply, /2 phiên bản/);
            assert.deepEqual(first.context.candidateBookIds, [10, 14]);

            const clarifyEdition = await recommend('Bản đặc biệt bìa cứng', first.context);
            assert.equal(clarifyEdition.intent, 'book_price');
            assert.deepEqual(clarifyEdition.books.map(b => b.id), [14]);
            assert.match(clarifyEdition.reply, /129\.000đ/);
            const cheaperEdition = await recommend('Cuốn thứ hai có bản rẻ hơn không?', { lastBookIds: [11, 14] });
            assert.deepEqual(cheaperEdition.books.map(book => book.id), [10]);
        } finally {
            catalogBooks.pop();
        }
    });

    await t.test('Trường hợp không tìm thấy sách -> Không tự tạo sách và không ghép sách khác từ mô tả', async () => {
        const result = await recommend('Giá sách Đắc Nhân Tâm bao nhiêu?');
        assert.equal(result.intent, 'book_price');
        assert.deepEqual(result.books, []);
        assert.match(result.reply, /chưa có cuốn sách “Đắc Nhân Tâm”/);
    });

    await t.test('Hỏi nội dung, đánh giá, thể loại trả lời đúng trọng tâm và sinh suggestions hợp lệ', async () => {
        const desc = await recommend('Cuốn Rừng Xanh Nước Bạc nói về gì vậy?');
        assert.equal(desc.intent, 'book_detail');
        assert.equal(desc.aspect, 'description');
        assert.deepEqual(desc.books.map(b => b.id), [11]);
        assert.match(desc.reply, /bộ lạc/i);
        assert.doesNotMatch(desc.reply, /tồn kho/i);
        assert.equal(desc.books[0].stockStatus, 'low');
        assert.ok(desc.suggestions.length > 0);

        const rating = await recommend('Án mạng đỏ được đánh giá mấy sao?');
        assert.equal(rating.intent, 'book_detail');
        assert.equal(rating.aspect, 'rating');
        assert.deepEqual(rating.books.map(b => b.id), [1]);
        assert.match(rating.reply, /4\.5\/5.*12 lượt/);

        const cat = await recommend('Rừng Xanh Nước Bạc thuộc thể loại gì?');
        assert.equal(cat.intent, 'book_detail');
        assert.equal(cat.aspect, 'category');
        assert.match(cat.reply, /Tiểu thuyết/);

        // Sau khi xem 1 cuốn sách cụ thể, chuyển sang tìm theo ngân sách không bị kẹt tên sách cũ
        const switched = await recommend('Sách dưới 300 nghìn', desc.context);
        assert.ok(switched.books.length > 1);
        assert.equal(switched.context.title, '');
    });
});
